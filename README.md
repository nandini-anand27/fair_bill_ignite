# Fair Bill - Hospital Bill Comparison Tool

A web application that helps families in Bengaluru compare their normal-delivery hospital bills against real bills from comparable hospitals. Built based on the PRISM project documents (Problem Brief, PRD-Lite, Design RFC, Task Breakdown, Solution Options Matrix).

## Tech Stack

- **Backend**: Django + Django REST Framework + SQLite
- **Frontend**: React (Node.js required)
- **Auth**: JWT (SimpleJWT)
- **Database**: SQLite (no server needed)

## Project Structure

```
fair_bill/
├── backend/                  # Django backend
│   ├── fair_bill_project/    # Django project settings
│   ├── accounts/             # User auth (register, login, admin login)
│   ├── bills/                # Core business logic (models, services, API)
│   ├── admin_panel/          # Admin management endpoints
│   ├── manage.py
│   ├── requirements.txt
│   └── .env                  # Environment config
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # Navbar, ProtectedRoute
│   │   ├── pages/user/      # Login, Register, Dashboard, Upload, Review, Results, Delete
│   │   ├── pages/admin/     # AdminLogin, Dashboard, UserManagement, BillReview, Monitoring
│   │   ├── services/        # API client (axios)
│   │   └── index.css        # Global styles
│   └── package.json
└── README.md
```

## Setup Instructions

### 1. Backend (Django)

```bash
cd backend
pip install -r requirements.txt

# Run migrations and seed data
python manage.py makemigrations accounts bills
python manage.py migrate
python manage.py seed_admin

# Start the server
python manage.py runserver
```

The backend runs on `http://127.0.0.1:8000`

**Admin credentials** (created by seed_admin):
- Email: `admin@fairbill.com`
- Password: `admin@123`

### 2. Frontend (React)

**Note**: Node.js must be installed. Download from https://nodejs.org

```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:3000`

## Features

### User Features
- Register and login with email/password
- Upload a hospital bill with line items
- Review and edit extracted line items
- Compare bill against peer group (same procedure, hospital tier, room category)
- View typical ranges (25th-75th percentile) per category
- See flags for unusual charges with plain-language explanations
- Optional consent to contribute bill to benchmark (with anonymization)
- Delete contributed bill using reference code

### Admin Features
- Single admin login (admin@fairbill.com / admin@123)
- Dashboard with statistics (users, bills, flags)
- User management (view, activate/deactivate, delete users)
- Bill review (approve/reject contributed bills before they enter the benchmark)
- Audit log monitoring

### PRISM Requirements Implemented
- FR-01: Bill upload with line items
- FR-02: Item extraction (manual entry)
- FR-03: Sum check with ₹1 tolerance
- FR-04: User review and correction of items
- FR-05: Hospital resolution and tier assignment
- FR-06: Item categorization (room, doctor fees, nursing, medicines, consumables, baby charges, tests, other)
- FR-07: Peer group comparison (same procedure, tier, room category, last 3 years)
- FR-08: Typical ranges (25th-75th percentile) with bill counts
- FR-09: Data sufficiency rules (<5 bills: no range, 5-9: limited data, 10+: normal)
- FR-10: Flag rules (duplicates, high amount, unusual item, sum mismatch, package inclusion)
- FR-11: Plain-language explanations with suggested questions (no banned terms)
- FR-12: Price-only notice on results
- FR-13: Optional consent (unchecked by default)
- FR-14: Identifier scrubbing before storage
- FR-15: Aggregate-only display (no individual bills shown)
- FR-16: Reference code for deletion
- FR-17: Admin review and approval of bills

## API Endpoints

### Auth
- `POST /api/accounts/register/` - User registration
- `POST /api/accounts/login/` - User login
- `POST /api/accounts/admin-login/` - Admin login
- `GET /api/accounts/profile/` - Get user profile

### Bills
- `GET /api/bills/` - List user's bills
- `GET /api/bills/:id/` - Get bill detail
- `POST /api/bills/upload/` - Upload new bill with items
- `PUT /api/bills/:id/update/` - Update bill items
- `POST /api/bills/:id/compare/` - Run comparison and flags
- `POST /api/bills/consent/` - Consent to contribute
- `POST /api/bills/delete/` - Delete contribution by reference code

### Admin
- `GET /api/admin-panel/users/` - List all users
- `PATCH /api/admin-panel/users/:id/toggle-active/` - Activate/deactivate user
- `DELETE /api/admin-panel/users/:id/delete/` - Delete user
- `GET /api/admin-panel/users/stats/` - Dashboard statistics
- `GET /api/admin-panel/bills/pending/` - Pending bills
- `GET /api/admin-panel/bills/all/` - All bills
- `POST /api/admin-panel/bills/:id/approve/` - Approve bill
- `POST /api/admin-panel/bills/:id/reject/` - Reject bill
- `GET /api/admin-panel/audit-log/` - Audit log
