# Turf Manager - Product Requirements Document

## Original Problem Statement
Build a clean, modern, mobile-friendly turf management web app with:
- Google login with shared data across users
- Calendar view with booking slots
- Add Entry form (Booking/Expense toggle)
- Dashboard with income/expenses/profit tracking
- Filters: daily, weekly, monthly, yearly
- Prevent duplicate/overlapping bookings
- Persistent MongoDB database

## User Personas
1. **Turf Owner/Manager**: Primary user who manages daily bookings and tracks expenses
2. **Business Partner**: Secondary user who needs visibility into bookings and revenue

## Core Requirements (Implemented)
- [x] Emergent-managed Google OAuth authentication
- [x] Calendar view (monthly + daily)
- [x] Fixed time slots (30-min intervals, 06:00-24:00)
- [x] Booking form with overlap validation
- [x] Expense tracking
- [x] Dashboard with stats (income, expenses, profit)
- [x] Analytics with bar/pie charts
- [x] Period filters (daily, weekly, monthly, yearly)
- [x] Multi-turf support with default turf
- [x] Mobile-first responsive design
- [x] Auto-refresh every 30 seconds

## What's Been Implemented (March 22, 2026)

### Backend (FastAPI + MongoDB)
- `/api/auth/session` - Exchange session_id for session_token
- `/api/auth/me` - Get current user
- `/api/auth/logout` - Logout and clear session
- `/api/turfs` - CRUD for turfs (with default turf creation)
- `/api/bookings` - CRUD with overlap validation
- `/api/expenses` - CRUD for expenses
- `/api/dashboard/stats` - Stats with period filters
- `/api/dashboard/calendar` - Calendar data by month
- `/api/available-slots` - Get slot availability for a day
- `/api/time-slots` - Get all possible time slots

### Frontend (React + Tailwind + Shadcn)
- Login page with Google OAuth
- Dashboard with calendar and quick stats
- Day view with time slots and bookings
- Add/Edit entry sheet (booking/expense toggle)
- Analytics page with charts
- Turf manager for adding/editing turfs
- Mobile bottom navigation
- Desktop top navigation
- Auto-refresh functionality

### Design System
- Orange primary (#F97316)
- Cream/white background (#FDFBF7)
- Barlow Condensed (headings) + Inter (body)
- Card-based layout with shadows
- Large touch targets (min 48px)

## Prioritized Backlog

### P0 (Critical) - Completed
- [x] Authentication flow
- [x] Booking CRUD with validation
- [x] Expense CRUD
- [x] Calendar view
- [x] Dashboard stats

### P1 (High Priority) - Future
- [ ] Push notifications for new bookings
- [ ] Export data to CSV/PDF
- [ ] Recurring bookings support

### P2 (Medium Priority) - Future
- [ ] Customer management (save customer details)
- [ ] Multiple users with role-based access
- [ ] Booking reminders via SMS/WhatsApp

## Next Tasks
1. Test with real Google OAuth login
2. Add data export functionality
3. Implement customer database for quick selection
