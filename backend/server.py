from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from google.oauth2 import id_token
from google.auth.transport import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initial authorized users (owners)
INITIAL_AUTHORIZED_EMAILS = [
    "vishaltripathi1497@gmail.com",
    "amittripathi1497@gmail.com"
]

# Create the main app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://fuzzy-palm-tree-4qr4vxvqpgw3q54w-3000.app.github.dev"
    ],
    allow_credentials=True,   # 🔥 IMPORTANT
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class UserSession(BaseModel):
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class Turf(BaseModel):
    turf_id: str
    name: str
    created_at: datetime
    updated_at: datetime

class TurfCreate(BaseModel):
    name: str

class TurfUpdate(BaseModel):
    name: str

class Booking(BaseModel):
    booking_id: str
    turf_id: str
    turf_name: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    customer_name: str
    phone_number: str
    price_per_hour: float
    total_price: float
    created_at: datetime
    updated_at: datetime

class BookingCreate(BaseModel):
    turf_id: str
    date: str
    start_time: str
    end_time: str
    customer_name: str
    phone_number: str
    price_per_hour: float

class BookingUpdate(BaseModel):
    turf_id: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    customer_name: Optional[str] = None
    phone_number: Optional[str] = None
    price_per_hour: Optional[float] = None

class Expense(BaseModel):
    expense_id: str
    turf_id: str
    turf_name: str
    date: str
    amount: float
    description: str
    created_at: datetime
    updated_at: datetime

class ExpenseCreate(BaseModel):
    turf_id: str
    date: str
    amount: float
    description: str

class ExpenseUpdate(BaseModel):
    turf_id: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None

# ==================== AUTHORIZED USER MODEL ====================

class AuthorizedUser(BaseModel):
    email: str
    added_by: str
    added_at: datetime

class AddAuthorizedUserRequest(BaseModel):
    email: str

# ==================== AUTHORIZATION HELPERS ====================

async def initialize_authorized_users():
    """Initialize authorized users collection with default owners if empty"""
    count = await db.authorized_users.count_documents({})
    if count == 0:
        for email in INITIAL_AUTHORIZED_EMAILS:
            await db.authorized_users.insert_one({
                "email": email.lower().strip(),
                "added_by": "system",
                "added_at": datetime.now(timezone.utc).isoformat()
            })
        logger.info(f"Initialized {len(INITIAL_AUTHORIZED_EMAILS)} authorized users")

async def is_email_authorized(email: str) -> bool:
    """Check if an email is in the authorized users list"""
    normalized_email = email.lower().strip()
    user = await db.authorized_users.find_one({"email": normalized_email}, {"_id": 0})
    return user is not None

async def get_authorized_user(request: Request) -> User:
    """Get current user and verify they are authorized"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Check if user is authorized
    print("user_doc: ", user_doc)
    if not await is_email_authorized(user_doc["email"]):
        raise HTTPException(status_code=403, detail="Access denied. Your email is not authorized.")
    
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

# ==================== ACTIVITY LOG MODEL ====================

class ActivityLog(BaseModel):
    log_id: str
    action: str  # create, update, delete
    entity_type: str  # booking, expense
    entity_id: str
    user_email: str
    user_name: str
    timestamp: datetime
    # For bookings
    booking_data: Optional[dict] = None
    # For expenses
    expense_data: Optional[dict] = None
    # For updates - stores old values
    old_values: Optional[dict] = None
    # For updates - stores new values
    new_values: Optional[dict] = None

# ==================== ACTIVITY LOGGING HELPERS ====================

async def log_activity(
    action: str,
    entity_type: str,
    entity_id: str,
    user: User,
    current_data: dict = None,
    old_data: dict = None,
    new_data: dict = None
):
    """Create an immutable activity log entry"""
    log_doc = {
        "log_id": f"log_{uuid.uuid4().hex[:12]}",
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_email": user.email,
        "user_name": user.name,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if entity_type == "booking":
        if current_data:
            # Calculate duration
            start_minutes = int(current_data.get("start_time", "00:00").split(':')[0]) * 60 + int(current_data.get("start_time", "00:00").split(':')[1])
            end_minutes = int(current_data.get("end_time", "00:00").split(':')[0]) * 60 + int(current_data.get("end_time", "00:00").split(':')[1])
            duration_hours = (end_minutes - start_minutes) / 60
            
            log_doc["booking_data"] = {
                "turf_name": current_data.get("turf_name"),
                "date": current_data.get("date"),
                "start_time": current_data.get("start_time"),
                "end_time": current_data.get("end_time"),
                "duration_hours": duration_hours,
                "price_per_hour": current_data.get("price_per_hour"),
                "total_price": current_data.get("total_price"),
                "customer_name": current_data.get("customer_name"),
                "phone_number": current_data.get("phone_number")
            }
    elif entity_type == "expense":
        if current_data:
            log_doc["expense_data"] = {
                "turf_name": current_data.get("turf_name"),
                "date": current_data.get("date"),
                "amount": current_data.get("amount"),
                "description": current_data.get("description")
            }
    
    # For updates, store old and new values
    if action == "update" and old_data and new_data:
        changes_old = {}
        changes_new = {}
        
        # Compare and store only changed fields
        for key in new_data.keys():
            if key in old_data and old_data.get(key) != new_data.get(key):
                changes_old[key] = old_data.get(key)
                changes_new[key] = new_data.get(key)
        
        if changes_old:
            log_doc["old_values"] = changes_old
            log_doc["new_values"] = changes_new
    
    # Insert log (immutable - never updated or deleted)
    await db.activity_logs.insert_one(log_doc)
    logger.info(f"Activity logged: {action} {entity_type} {entity_id} by {user.email}")

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/google")
async def google_login(data: dict):
    from google.oauth2 import id_token
    from google.auth.transport import requests

    token = data.get("token")

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            os.environ["GOOGLE_CLIENT_ID"]
        )

        email = idinfo["email"]
        name = idinfo.get("name", "")

        print("GOOGLE EMAIL:", email)
        print("IS AUTHORIZED:", await is_email_authorized(email))

        # 🔥 IMPORTANT: check authorization
        is_authorized_user = await is_email_authorized(email)

        return {
            "email": email,
            "name": name,
            "is_authorized": is_authorized_user  # ✅ THIS IS KEY
        }

    except Exception as e:
        print("ERROR:", str(e))
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    token = body.get("token")

    if not token:
        raise HTTPException(status_code=400, detail="Token required")

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            os.environ["GOOGLE_CLIENT_ID"]
        )

        email = idinfo["email"]
        name = idinfo.get("name")
        picture = idinfo.get("picture")

    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Create / update user
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})

    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    else:
        user_id = user_doc["user_id"]

    # ✅ FIX: create real session token
    session_token = f"sess_{uuid.uuid4().hex}"

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # ✅ FIX COOKIE (IMPORTANT)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        domain=".onrender.com",
        path="/"
    )

    is_authorized = await is_email_authorized(email)

    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "is_authorized": is_authorized
    }

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    is_authorized = await is_email_authorized(user.email)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "is_authorized": is_authorized
    }

@api_router.get("/auth/check-authorization")
async def check_authorization(user: User = Depends(get_current_user)):
    """Check if current user is authorized"""
    is_authorized = await is_email_authorized(user.email)
    return {
        "email": user.email,
        "is_authorized": is_authorized
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== TURF ENDPOINTS ====================

@api_router.get("/turfs", response_model=List[Turf])
async def get_turfs(user: User = Depends(get_authorized_user)):
    """Get all turfs"""
    turfs = await db.turfs.find({}, {"_id": 0}).to_list(100)
    
    # Create default turf if none exist
    if not turfs:
        default_turf = {
            "turf_id": f"turf_{uuid.uuid4().hex[:8]}",
            "name": "Main Turf",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.turfs.insert_one(default_turf)
        turfs = [default_turf]
    
    for turf in turfs:
        if isinstance(turf.get("created_at"), str):
            turf["created_at"] = datetime.fromisoformat(turf["created_at"])
        if isinstance(turf.get("updated_at"), str):
            turf["updated_at"] = datetime.fromisoformat(turf["updated_at"])
    
    return turfs

@api_router.post("/turfs", response_model=Turf)
async def create_turf(turf_data: TurfCreate, user: User = Depends(get_authorized_user)):
    """Create a new turf"""
    turf_doc = {
        "turf_id": f"turf_{uuid.uuid4().hex[:8]}",
        "name": turf_data.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.turfs.insert_one(turf_doc)
    turf_doc["created_at"] = datetime.fromisoformat(turf_doc["created_at"])
    turf_doc["updated_at"] = datetime.fromisoformat(turf_doc["updated_at"])
    return Turf(**turf_doc)

@api_router.put("/turfs/{turf_id}", response_model=Turf)
async def update_turf(turf_id: str, turf_data: TurfUpdate, user: User = Depends(get_authorized_user)):
    """Update a turf"""
    result = await db.turfs.find_one_and_update(
        {"turf_id": turf_id},
        {"$set": {
            "name": turf_data.name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Turf not found")
    
    turf_doc = await db.turfs.find_one({"turf_id": turf_id}, {"_id": 0})
    if isinstance(turf_doc.get("created_at"), str):
        turf_doc["created_at"] = datetime.fromisoformat(turf_doc["created_at"])
    if isinstance(turf_doc.get("updated_at"), str):
        turf_doc["updated_at"] = datetime.fromisoformat(turf_doc["updated_at"])
    return Turf(**turf_doc)

@api_router.delete("/turfs/{turf_id}")
async def delete_turf(turf_id: str, user: User = Depends(get_authorized_user)):
    """Delete a turf"""
    # Check if turf has bookings
    booking_count = await db.bookings.count_documents({"turf_id": turf_id})
    if booking_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete turf with existing bookings")
    
    result = await db.turfs.delete_one({"turf_id": turf_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Turf not found")
    
    return {"message": "Turf deleted successfully"}

# ==================== BOOKING ENDPOINTS ====================

def calculate_duration_hours(start_time: str, end_time: str) -> float:
    """Calculate duration in hours between two times"""
    start = datetime.strptime(start_time, "%H:%M")
    end = datetime.strptime(end_time, "%H:%M")
    duration = (end - start).seconds / 3600
    return duration

def times_overlap(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if two time ranges overlap"""
    s1 = datetime.strptime(start1, "%H:%M")
    e1 = datetime.strptime(end1, "%H:%M")
    s2 = datetime.strptime(start2, "%H:%M")
    e2 = datetime.strptime(end2, "%H:%M")
    return s1 < e2 and s2 < e1

def validate_time_slot(start_time: str, end_time: str) -> bool:
    """Validate that time slots are aligned to 30-minute intervals"""
    try:
        start = datetime.strptime(start_time, "%H:%M")
        end = datetime.strptime(end_time, "%H:%M")
        
        # Check 30-minute alignment
        if start.minute not in [0, 30] or end.minute not in [0, 30]:
            return False
        
        # End must be after start
        if end <= start:
            return False
        
        return True
    except ValueError:
        return False

@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings(
    date: Optional[str] = None,
    turf_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_authorized_user)
):
    """Get bookings with optional filters"""
    query = {}
    
    if date:
        query["date"] = date
    elif start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    if turf_id:
        query["turf_id"] = turf_id
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    
    for booking in bookings:
        if isinstance(booking.get("created_at"), str):
            booking["created_at"] = datetime.fromisoformat(booking["created_at"])
        if isinstance(booking.get("updated_at"), str):
            booking["updated_at"] = datetime.fromisoformat(booking["updated_at"])
    
    return bookings

@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate, user: User = Depends(get_authorized_user)):
    """Create a new booking with overlap validation"""
    
    # Validate time slot alignment
    if not validate_time_slot(booking_data.start_time, booking_data.end_time):
        raise HTTPException(
            status_code=400, 
            detail="Invalid time slot. Times must be aligned to 30-minute intervals (e.g., 06:00, 06:30, 07:00)"
        )
    
    # Check for overlapping bookings
    existing_bookings = await db.bookings.find(
        {"turf_id": booking_data.turf_id, "date": booking_data.date},
        {"_id": 0}
    ).to_list(100)
    
    for existing in existing_bookings:
        if times_overlap(
            booking_data.start_time, booking_data.end_time,
            existing["start_time"], existing["end_time"]
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Time slot overlaps with existing booking ({existing['start_time']} - {existing['end_time']})"
            )
    
    # Get turf name
    turf = await db.turfs.find_one({"turf_id": booking_data.turf_id}, {"_id": 0})
    if not turf:
        raise HTTPException(status_code=404, detail="Turf not found")
    
    # Calculate total price
    duration = calculate_duration_hours(booking_data.start_time, booking_data.end_time)
    total_price = duration * booking_data.price_per_hour
    
    booking_doc = {
        "booking_id": f"book_{uuid.uuid4().hex[:8]}",
        "turf_id": booking_data.turf_id,
        "turf_name": turf["name"],
        "date": booking_data.date,
        "start_time": booking_data.start_time,
        "end_time": booking_data.end_time,
        "customer_name": booking_data.customer_name,
        "phone_number": booking_data.phone_number,
        "price_per_hour": booking_data.price_per_hour,
        "total_price": total_price,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bookings.insert_one(booking_doc)
    
    # Log activity
    await log_activity(
        action="create",
        entity_type="booking",
        entity_id=booking_doc["booking_id"],
        user=user,
        current_data=booking_doc
    )
    
    booking_doc["created_at"] = datetime.fromisoformat(booking_doc["created_at"])
    booking_doc["updated_at"] = datetime.fromisoformat(booking_doc["updated_at"])
    return Booking(**booking_doc)

@api_router.put("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, booking_data: BookingUpdate, user: User = Depends(get_authorized_user)):
    """Update a booking"""
    existing = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_fields = {}
    
    # Build update fields
    new_turf_id = booking_data.turf_id or existing["turf_id"]
    new_date = booking_data.date or existing["date"]
    new_start = booking_data.start_time or existing["start_time"]
    new_end = booking_data.end_time or existing["end_time"]
    new_price_per_hour = booking_data.price_per_hour if booking_data.price_per_hour is not None else existing["price_per_hour"]
    
    # Validate time slot if times are being updated
    if booking_data.start_time or booking_data.end_time:
        if not validate_time_slot(new_start, new_end):
            raise HTTPException(
                status_code=400,
                detail="Invalid time slot. Times must be aligned to 30-minute intervals"
            )
    
    # Check for overlaps if turf, date, or time is changing
    if booking_data.turf_id or booking_data.date or booking_data.start_time or booking_data.end_time:
        other_bookings = await db.bookings.find(
            {"turf_id": new_turf_id, "date": new_date, "booking_id": {"$ne": booking_id}},
            {"_id": 0}
        ).to_list(100)
        
        for other in other_bookings:
            if times_overlap(new_start, new_end, other["start_time"], other["end_time"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"Time slot overlaps with existing booking ({other['start_time']} - {other['end_time']})"
                )
    
    # Update turf name if turf changed
    if booking_data.turf_id:
        turf = await db.turfs.find_one({"turf_id": booking_data.turf_id}, {"_id": 0})
        if not turf:
            raise HTTPException(status_code=404, detail="Turf not found")
        update_fields["turf_id"] = booking_data.turf_id
        update_fields["turf_name"] = turf["name"]
    
    if booking_data.date:
        update_fields["date"] = booking_data.date
    if booking_data.start_time:
        update_fields["start_time"] = booking_data.start_time
    if booking_data.end_time:
        update_fields["end_time"] = booking_data.end_time
    if booking_data.customer_name:
        update_fields["customer_name"] = booking_data.customer_name
    if booking_data.phone_number:
        update_fields["phone_number"] = booking_data.phone_number
    if booking_data.price_per_hour is not None:
        update_fields["price_per_hour"] = booking_data.price_per_hour
    
    # Recalculate total price
    duration = calculate_duration_hours(new_start, new_end)
    update_fields["total_price"] = duration * new_price_per_hour
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": update_fields})
    
    updated = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    
    # Log activity with old and new values
    await log_activity(
        action="update",
        entity_type="booking",
        entity_id=booking_id,
        user=user,
        current_data=updated,
        old_data=existing,
        new_data=updated
    )
    
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    if isinstance(updated.get("updated_at"), str):
        updated["updated_at"] = datetime.fromisoformat(updated["updated_at"])
    return Booking(**updated)

@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, user: User = Depends(get_authorized_user)):
    """Delete a booking"""
    # Get booking data before deleting for logging
    existing = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    result = await db.bookings.delete_one({"booking_id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Log activity
    await log_activity(
        action="delete",
        entity_type="booking",
        entity_id=booking_id,
        user=user,
        current_data=existing
    )
    
    return {"message": "Booking deleted successfully"}

# ==================== EXPENSE ENDPOINTS ====================

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(
    date: Optional[str] = None,
    turf_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_authorized_user)
):
    """Get expenses with optional filters"""
    query = {}
    
    if date:
        query["date"] = date
    elif start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    if turf_id:
        query["turf_id"] = turf_id
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    
    for expense in expenses:
        if isinstance(expense.get("created_at"), str):
            expense["created_at"] = datetime.fromisoformat(expense["created_at"])
        if isinstance(expense.get("updated_at"), str):
            expense["updated_at"] = datetime.fromisoformat(expense["updated_at"])
    
    return expenses

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate, user: User = Depends(get_authorized_user)):
    """Create a new expense"""
    # Get turf name
    turf = await db.turfs.find_one({"turf_id": expense_data.turf_id}, {"_id": 0})
    if not turf:
        raise HTTPException(status_code=404, detail="Turf not found")
    
    expense_doc = {
        "expense_id": f"exp_{uuid.uuid4().hex[:8]}",
        "turf_id": expense_data.turf_id,
        "turf_name": turf["name"],
        "date": expense_data.date,
        "amount": expense_data.amount,
        "description": expense_data.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.expenses.insert_one(expense_doc)
    
    # Log activity
    await log_activity(
        action="create",
        entity_type="expense",
        entity_id=expense_doc["expense_id"],
        user=user,
        current_data=expense_doc
    )
    
    expense_doc["created_at"] = datetime.fromisoformat(expense_doc["created_at"])
    expense_doc["updated_at"] = datetime.fromisoformat(expense_doc["updated_at"])
    return Expense(**expense_doc)

@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_data: ExpenseUpdate, user: User = Depends(get_authorized_user)):
    """Update an expense"""
    existing = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if expense_data.turf_id:
        turf = await db.turfs.find_one({"turf_id": expense_data.turf_id}, {"_id": 0})
        if not turf:
            raise HTTPException(status_code=404, detail="Turf not found")
        update_fields["turf_id"] = expense_data.turf_id
        update_fields["turf_name"] = turf["name"]
    
    if expense_data.date:
        update_fields["date"] = expense_data.date
    if expense_data.amount is not None:
        update_fields["amount"] = expense_data.amount
    if expense_data.description:
        update_fields["description"] = expense_data.description
    
    await db.expenses.update_one({"expense_id": expense_id}, {"$set": update_fields})
    
    updated = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    
    # Log activity with old and new values
    await log_activity(
        action="update",
        entity_type="expense",
        entity_id=expense_id,
        user=user,
        current_data=updated,
        old_data=existing,
        new_data=updated
    )
    
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    if isinstance(updated.get("updated_at"), str):
        updated["updated_at"] = datetime.fromisoformat(updated["updated_at"])
    return Expense(**updated)

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: User = Depends(get_authorized_user)):
    """Delete an expense"""
    # Get expense data before deleting for logging
    existing = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    result = await db.expenses.delete_one({"expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Log activity
    await log_activity(
        action="delete",
        entity_type="expense",
        entity_id=expense_id,
        user=user,
        current_data=existing
    )
    
    return {"message": "Expense deleted successfully"}

# ==================== DASHBOARD ENDPOINTS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    period: str = "monthly",  # daily, weekly, monthly, yearly
    date: Optional[str] = None,  # Reference date
    turf_id: Optional[str] = None,
    user: User = Depends(get_authorized_user)
):
    """Get dashboard statistics"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    ref_date = datetime.strptime(date, "%Y-%m-%d")
    
    # Calculate date range based on period
    if period == "daily":
        start_date = date
        end_date = date
    elif period == "weekly":
        start_of_week = ref_date - timedelta(days=ref_date.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        start_date = start_of_week.strftime("%Y-%m-%d")
        end_date = end_of_week.strftime("%Y-%m-%d")
    elif period == "monthly":
        start_date = ref_date.replace(day=1).strftime("%Y-%m-%d")
        next_month = ref_date.replace(day=28) + timedelta(days=4)
        end_date = (next_month.replace(day=1) - timedelta(days=1)).strftime("%Y-%m-%d")
    else:  # yearly
        start_date = ref_date.replace(month=1, day=1).strftime("%Y-%m-%d")
        end_date = ref_date.replace(month=12, day=31).strftime("%Y-%m-%d")
    
    # Build query
    query = {"date": {"$gte": start_date, "$lte": end_date}}
    if turf_id:
        query["turf_id"] = turf_id
    
    # Get bookings and expenses
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(1000)
    
    total_income = sum(b["total_price"] for b in bookings)
    total_expenses = sum(e["amount"] for e in expenses)
    profit = total_income - total_expenses
    
    # Group by date for chart data
    income_by_date = {}
    expense_by_date = {}
    
    for booking in bookings:
        d = booking["date"]
        income_by_date[d] = income_by_date.get(d, 0) + booking["total_price"]
    
    for expense in expenses:
        d = expense["date"]
        expense_by_date[d] = expense_by_date.get(d, 0) + expense["amount"]
    
    # Create chart data
    all_dates = sorted(set(list(income_by_date.keys()) + list(expense_by_date.keys())))
    chart_data = [
        {
            "date": d,
            "income": income_by_date.get(d, 0),
            "expense": expense_by_date.get(d, 0),
            "profit": income_by_date.get(d, 0) - expense_by_date.get(d, 0)
        }
        for d in all_dates
    ]
    
    return {
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "profit": profit,
        "booking_count": len(bookings),
        "expense_count": len(expenses),
        "chart_data": chart_data
    }

@api_router.get("/dashboard/calendar")
async def get_calendar_data(
    month: str,  # YYYY-MM format
    turf_id: Optional[str] = None,
    user: User = Depends(get_authorized_user)
):
    """Get calendar data for a month"""
    year, month_num = map(int, month.split("-"))
    start_date = f"{year}-{month_num:02d}-01"
    
    # Calculate end of month
    if month_num == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month_num + 1:02d}-01"
    
    end_date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    
    query = {"date": {"$gte": start_date, "$lte": end_date}}
    if turf_id:
        query["turf_id"] = turf_id
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(1000)
    
    # Group by date
    bookings_by_date = {}
    expenses_by_date = {}
    
    for booking in bookings:
        d = booking["date"]
        if d not in bookings_by_date:
            bookings_by_date[d] = []
        bookings_by_date[d].append(booking)
    
    for expense in expenses:
        d = expense["date"]
        if d not in expenses_by_date:
            expenses_by_date[d] = []
        expenses_by_date[d].append(expense)
    
    return {
        "month": month,
        "bookings_by_date": bookings_by_date,
        "expenses_by_date": expenses_by_date
    }

# ==================== TIME SLOTS ====================

@api_router.get("/time-slots")
async def get_time_slots(user: User = Depends(get_authorized_user)):
    """Get available time slot options"""
    slots = []
    for hour in range(6, 24):  # 6 AM to 11 PM
        slots.append(f"{hour:02d}:00")
        slots.append(f"{hour:02d}:30")
    slots.append("00:00")  # Midnight
    return {"slots": slots}

@api_router.get("/available-slots")
async def get_available_slots(
    turf_id: str,
    date: str,
    user: User = Depends(get_authorized_user)
):
    """Get available time slots for a turf on a specific date"""
    # Generate all possible slots
    all_slots = []
    for hour in range(6, 24):
        all_slots.append(f"{hour:02d}:00")
        all_slots.append(f"{hour:02d}:30")
    
    # Get existing bookings
    bookings = await db.bookings.find(
        {"turf_id": turf_id, "date": date},
        {"_id": 0}
    ).to_list(100)
    
    # Mark booked slots
    booked_ranges = [(b["start_time"], b["end_time"]) for b in bookings]
    
    available_slots = []
    for slot in all_slots:
        is_booked = False
        for start, end in booked_ranges:
            # Check if slot falls within booked range
            slot_time = datetime.strptime(slot, "%H:%M")
            start_time = datetime.strptime(start, "%H:%M")
            end_time = datetime.strptime(end, "%H:%M")
            if start_time <= slot_time < end_time:
                is_booked = True
                break
        available_slots.append({"time": slot, "available": not is_booked})
    
    return {
        "turf_id": turf_id,
        "date": date,
        "slots": available_slots,
        "bookings": bookings
    }

# ==================== ACTIVITY LOGS ENDPOINTS ====================

@api_router.get("/activity-logs")
async def get_activity_logs(
    limit: int = 50,
    offset: int = 0,
    entity_type: Optional[str] = None,  # booking, expense
    action: Optional[str] = None,  # create, update, delete
    user: User = Depends(get_authorized_user)
):
    """Get activity logs (immutable audit trail)"""
    query = {}
    
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    
    # Get total count
    total_count = await db.activity_logs.count_documents(query)
    
    # Get logs sorted by timestamp descending (newest first)
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    
    # Convert timestamp strings to datetime for response
    for log in logs:
        if isinstance(log.get("timestamp"), str):
            log["timestamp"] = datetime.fromisoformat(log["timestamp"])
    
    return {
        "logs": logs,
        "total": total_count,
        "limit": limit,
        "offset": offset
    }

@api_router.get("/activity-logs/{log_id}")
async def get_activity_log_detail(log_id: str, user: User = Depends(get_authorized_user)):
    """Get a single activity log entry"""
    log = await db.activity_logs.find_one({"log_id": log_id}, {"_id": 0})
    
    if not log:
        raise HTTPException(status_code=404, detail="Activity log not found")
    
    if isinstance(log.get("timestamp"), str):
        log["timestamp"] = datetime.fromisoformat(log["timestamp"])
    
    return log

# ==================== USER MANAGEMENT ENDPOINTS ====================

@api_router.get("/users/authorized")
async def get_authorized_users_list(user: User = Depends(get_authorized_user)):
    """Get list of all authorized users"""
    users = await db.authorized_users.find({}, {"_id": 0}).sort("added_at", 1).to_list(100)
    
    for u in users:
        if isinstance(u.get("added_at"), str):
            u["added_at"] = datetime.fromisoformat(u["added_at"])
    
    return {"users": users, "total": len(users)}

@api_router.post("/users/authorized")
async def add_authorized_user(
    request_data: AddAuthorizedUserRequest,
    user: User = Depends(get_authorized_user)
):
    """Add a new authorized user"""
    email = request_data.email.lower().strip()
    
    # Validate email format
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if already exists
    existing = await db.authorized_users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already authorized")
    
    # Add new authorized user
    new_user = {
        "email": email,
        "added_by": user.email,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    await db.authorized_users.insert_one(new_user)
    
    logger.info(f"Authorized user added: {email} by {user.email}")
    
    return {"message": "User authorized successfully", "email": email}

@api_router.delete("/users/authorized/{email}")
async def remove_authorized_user(email: str, user: User = Depends(get_authorized_user)):
    """Remove an authorized user"""
    email = email.lower().strip()
    
    # Check if user exists
    existing = await db.authorized_users.find_one({"email": email}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent removing the last user
    count = await db.authorized_users.count_documents({})
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the last authorized user")
    
    # Prevent removing yourself
    if email == user.email.lower():
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    
    # Remove user
    await db.authorized_users.delete_one({"email": email})
    
    # Also remove their sessions to revoke access immediately
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if user_doc:
        await db.user_sessions.delete_many({"user_id": user_doc["user_id"]})
    
    logger.info(f"Authorized user removed: {email} by {user.email}")
    
    return {"message": "User removed successfully", "email": email}

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Turf Management API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize authorized users on startup"""
    await initialize_authorized_users()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
