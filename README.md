# Fair Bill - Hospital Bill Comparison Tool

A web application that helps families in Bengaluru compare their normal-delivery hospital bills against real bills from comparable hospitals. Built based on the PRISM project documents (Problem Brief, PRD-Lite, Design RFC, Task Breakdown, Solution Options Matrix).

## Tech Stack

- **Backend**: Django + Django REST Framework + SQLite
- **Frontend**: React (Node.js required)
- **Auth**: JWT (SimpleJWT)
- **Database**: SQLite (no server needed)
- **Image Scanning**: Groq API (qwen/qwen3.8-27b vision model)

## Project Structure

```
fair_bill/
├── backend/                  # Django backend
│   ├── fair_bill_project/    # Django project settings
│   ├── accounts/             # User auth (register, login, admin login)
│   ├── bills/                # Core business logic (models, services, API)
│   │   ├── image_extractor.py        # Groq vision-based bill scanning
│   │   ├── services.py               # Comparison engine, flag rules, explainer
│   │   └── management/commands/
│   │       ├── seed_reference_data.py  # 75 synthetic benchmark bills
│   │       └── import_sample_bills.py  # 18 sample bills from real documents
│   ├── admin_panel/          # Admin management endpoints
│   ├── manage.py
│   ├── requirements.txt
│   └── .env                  # Environment config (GROQ_API_KEY required)
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # Navbar (with dark mode toggle), ProtectedRoute
│   │   ├── hooks/            # useDarkMode hook
│   │   ├── pages/
│   │   │   ├── Landing.js    # Public landing page (/)
│   │   │   ├── user/         # Login, Register, Dashboard, Upload, Review, Results, Delete
│   │   │   └── admin/        # AdminLogin, Dashboard, UserManagement, BillReview,
│   │   │                     # Monitoring, HospitalManagement
│   │   ├── services/         # API client (axios)
│   │   ├── data/             # Bengaluru hospital directory data
│   │   └── index.css         # Design system (warm theme + dark mode tokens)
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

# Seed benchmark reference data (75 synthetic bills)
python manage.py seed_reference_data

# Import sample bills from real documents (18 bills)
python manage.py import_sample_bills

# Start the server
python manage.py runserver
```

The backend runs on `http://127.0.0.1:8000`

**Admin credentials** (created by seed_admin):
- Email: `admin@fairbill.com`
- Password: `admin@123`

### 2. Environment Variables

Create `backend/.env` with:

```
SECRET_KEY=your-django-secret-key
DEBUG=True
GROQ_API_KEY=your-groq-api-key
```

Get a free Groq API key at https://console.groq.com/keys (no credit card required).

### 3. Frontend (React)

**Note**: Node.js must be installed. Download from https://nodejs.org

```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:3000`

## Features

### User Features
- Landing page with how-it-works, FAQ, and CTA
- Register and login with email/password
- Upload a hospital bill (photo or PDF) — Groq AI extracts line items and bill metadata automatically
- Review and edit extracted line items; bill details auto-filled from scan
- Compare bill against peer group (same procedure, hospital tier, room category, city)
- Visual range bar per item showing where your charge sits in the peer distribution
- Confidence indicator (High / Moderate / Low) with breakdown factors
- Flagged items with plain-language explanations and suggested questions for the billing desk
- Download/print comparison summary
- Re-run comparison on demand
- Bengaluru hospital directory (40+ hospitals with costs, amenities, ratings, tier filters)
- Optional consent to contribute bill to benchmark (with anonymisation)
- Delete contributed bill using reference code
- Dark mode (persists to localStorage, respects OS preference)

### Admin Features
- Single admin login (admin@fairbill.com / admin@123)
- Dashboard with stats, benchmark health (real vs synthetic split, tier breakdown), recent activity feed
- User management with search, filter, activate/deactivate, delete
- Bill review with Pending / Approved / Rejected / All tabs, collapsible line items, flag badges, provenance badges
- Hospital management — view, add, delete benchmark hospitals
- Audit log with colour-coded action badges, actor/action search

### Benchmark Data
- 75 synthetic reference bills with price ranges sourced from real Bengaluru hospital data (BMCRI fee schedule, Cloudnine/Manipal/Apollo Cradle actual bills, community reports 2022–2024). Room category multipliers removed — prices reflect real per-day rates (large private room: ₹4,500–₹8,000/day).
- 18 sample bills extracted from real hospital bill documents (Victoria, Vani Vilas, Cloudnine, Apollo Cradle, Manipal, Motherhood, Fortis, Aster, Ovum, Sagar)
- 27 real Bengaluru hospitals in the benchmark database
- Item key normalization maps common bill description variants (e.g. "Room Rent – Deluxe Room") to canonical benchmark keys (e.g. "room charges per day") so comparisons always find matches

### PRISM Requirements Implemented
- FR-01: Bill upload with line items
- FR-02: AI-assisted item extraction (Groq vision) with manual fallback
- FR-03: Sum check with ₹1 tolerance
- FR-04: User review and correction of items
- FR-05: Hospital resolution and tier assignment
- FR-06: Item categorisation (room, doctor fees, nursing, medicines, consumables, baby charges, tests, other)
- FR-07: Peer group comparison (same procedure, tier, room category, city)
- FR-08: Typical ranges (25th–75th percentile) with visual bar
- FR-09: Data sufficiency rules (<3 bills: no range, 3–9: limited data, 10+: normal)
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
- `POST /api/accounts/token/refresh/` - Refresh JWT token

### Bills
- `GET /api/bills/` - List user's bills
- `GET /api/bills/:id/` - Get bill detail
- `POST /api/bills/upload/` - Upload new bill with items
- `POST /api/bills/extract-image/` - Extract line items and metadata from a bill image (Groq)
- `PUT /api/bills/:id/update/` - Update bill items
- `POST /api/bills/:id/compare/` - Run comparison and flags
- `POST /api/bills/consent/` - Consent to contribute
- `POST /api/bills/delete/` - Delete contribution by reference code
- `GET /api/bills/hospitals/` - List hospitals for bill entry

### Admin
- `GET /api/admin-panel/users/` - List all users
- `PATCH /api/admin-panel/users/:id/toggle-active/` - Activate/deactivate user
- `DELETE /api/admin-panel/users/:id/delete/` - Delete user
- `GET /api/admin-panel/users/stats/` - Dashboard statistics
- `GET /api/admin-panel/bills/pending/` - Pending bills awaiting review
- `GET /api/admin-panel/bills/all/` - All bills
- `POST /api/admin-panel/bills/:id/approve/` - Approve bill for benchmark
- `POST /api/admin-panel/bills/:id/reject/` - Reject bill
- `GET /api/admin-panel/hospitals/` - List hospitals
- `POST /api/admin-panel/hospitals/` - Add a hospital
- `PUT/DELETE /api/admin-panel/hospitals/:id/` - Update or remove a hospital
- `GET /api/admin-panel/audit-log/` - Audit log (last 200 entries)
