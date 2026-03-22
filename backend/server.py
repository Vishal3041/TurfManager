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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

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

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    
    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    
    auth_data = auth_response.json()
    
    # Check if user exists, if not create
    user_doc = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    
    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    else:
        user_id = user_doc["user_id"]
        # Update user info if changed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data["name"],
                "picture": auth_data.get("picture")
            }}
        )
    
    # Create session
    session_token = auth_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "user_id": user_id,
        "email": auth_data["email"],
        "name": auth_data["name"],
        "picture": auth_data.get("picture")
    }

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture
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
async def get_turfs(user: User = Depends(get_current_user)):
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
async def create_turf(turf_data: TurfCreate, user: User = Depends(get_current_user)):
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
async def update_turf(turf_id: str, turf_data: TurfUpdate, user: User = Depends(get_current_user)):
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
async def delete_turf(turf_id: str, user: User = Depends(get_current_user)):
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
    user: User = Depends(get_current_user)
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
async def create_booking(booking_data: BookingCreate, user: User = Depends(get_current_user)):
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
    booking_doc["created_at"] = datetime.fromisoformat(booking_doc["created_at"])
    booking_doc["updated_at"] = datetime.fromisoformat(booking_doc["updated_at"])
    return Booking(**booking_doc)

@api_router.put("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, booking_data: BookingUpdate, user: User = Depends(get_current_user)):
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
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    if isinstance(updated.get("updated_at"), str):
        updated["updated_at"] = datetime.fromisoformat(updated["updated_at"])
    return Booking(**updated)

@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, user: User = Depends(get_current_user)):
    """Delete a booking"""
    result = await db.bookings.delete_one({"booking_id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking deleted successfully"}

# ==================== EXPENSE ENDPOINTS ====================

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(
    date: Optional[str] = None,
    turf_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user)
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
async def create_expense(expense_data: ExpenseCreate, user: User = Depends(get_current_user)):
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
    expense_doc["created_at"] = datetime.fromisoformat(expense_doc["created_at"])
    expense_doc["updated_at"] = datetime.fromisoformat(expense_doc["updated_at"])
    return Expense(**expense_doc)

@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_data: ExpenseUpdate, user: User = Depends(get_current_user)):
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
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    if isinstance(updated.get("updated_at"), str):
        updated["updated_at"] = datetime.fromisoformat(updated["updated_at"])
    return Expense(**updated)

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: User = Depends(get_current_user)):
    """Delete an expense"""
    result = await db.expenses.delete_one({"expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}

# ==================== DASHBOARD ENDPOINTS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    period: str = "monthly",  # daily, weekly, monthly, yearly
    date: Optional[str] = None,  # Reference date
    turf_id: Optional[str] = None,
    user: User = Depends(get_current_user)
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
    user: User = Depends(get_current_user)
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
async def get_time_slots(user: User = Depends(get_current_user)):
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
    user: User = Depends(get_current_user)
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
