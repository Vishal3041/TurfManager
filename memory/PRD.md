# Turf Manager - Product Requirements Document

## Original Problem Statement
Build a clean, modern, mobile-friendly turf management web app with:
- Google login with shared data across users
- Calendar view with booking slots
- Add Entry form (Booking/Expense toggle)
- Dashboard with income/expenses/profit tracking
- User Management and Access Control
- Activity audit logging
- INR currency support

## User Personas
1. **Turf Owner/Manager**: Primary user who manages daily bookings and tracks expenses
2. **Business Partner**: Secondary user who needs visibility into bookings and revenue

## Core Requirements (Implemented)
- [x] Emergent-managed Google OAuth authentication
- [x] User Management with email whitelist access control
- [x] Access Denied screen for unauthorized users
- [x] Calendar view (monthly + daily)
- [x] Fixed time slots (30-min intervals, 06:00-24:00)
- [x] Booking form with overlap validation
- [x] Expense tracking
- [x] Dashboard with stats (income, expenses, profit)
- [x] Analytics with bar/pie charts
- [x] Period filters (daily, weekly, monthly, yearly)
- [x] Multi-turf support with default turf
- [x] Activity audit logging (create, update, delete)
- [x] Mobile-first responsive design
- [x] Auto-refresh every 30 seconds
- [x] INR currency with Indian number formatting

## What's Been Implemented (March 23, 2026)

### Backend (FastAPI + MongoDB)
- Authentication with Emergent OAuth
- User Management with whitelist access control
  - Initial authorized users: vishaltripathi1497@gmail.com, amittripathi1497@gmail.com
  - Add/Remove users via API
  - Prevent removing last user or yourself
- Turfs CRUD with default turf
- Bookings CRUD with overlap validation
- Expenses CRUD
- Dashboard stats with period filters
- Activity audit logging (immutable)

### Frontend (React + Tailwind + Shadcn)
- Login page with Google OAuth
- Access Denied page for unauthorized users
- User Management panel
- Dashboard with calendar and quick stats
- Day view with time slots and bookings
- Add/Edit entry sheet (booking/expense toggle)
- Analytics page with charts
- Activity page with audit logs
- Mobile bottom navigation (3 tabs)
- Desktop top navigation

### Design System
- Orange primary (#F97316)
- Cream/white background (#FDFBF7)
- Barlow Condensed (headings) + Inter (body)
- Card-based layout with shadows
- Large touch targets (min 48px)
- INR currency formatting (₹)

### UI Fixes Applied
- Global bottom padding (pb-32) for Emergent badge
- Sticky Save button in sheets with 60px margin
- FAB positioned at bottom-24 (above badge)
- Proper z-index ordering (z-50 for FAB, z-40 for nav)

## Prioritized Backlog

### P0 (Critical) - Completed
- [x] Authentication with access control
- [x] Booking CRUD with validation
- [x] Expense CRUD
- [x] Calendar view
- [x] Dashboard stats
- [x] Activity logging
- [x] User Management

### P1 (High Priority) - Future
- [ ] Push notifications for new bookings
- [ ] Export data to CSV/PDF
- [ ] Recurring bookings support

### P2 (Medium Priority) - Future
- [ ] Customer management (save customer details)
- [ ] Role-based access (admin vs viewer)
- [ ] Booking reminders via SMS/WhatsApp

## Next Tasks
1. Test with real Google OAuth login
2. Add data export functionality
3. Implement customer database for quick selection
