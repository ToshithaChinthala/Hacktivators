# TrustSphere AI 🛡️

**Hackathon Edition** — Full-stack cybersecurity trust platform.

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + Tailwind CSS + Framer Motion |
| Backend | Python + FastAPI + Uvicorn |
| Database | MySQL 8 (primary) + Prisma Studio |
| ORM | SQLAlchemy + PyMySQL |
| Real-time | FastAPI WebSockets |
| Security | SHA-256 / hashlib |

## Local URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| FastAPI | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Prisma Studio | http://localhost:5555 |
| MySQL | localhost:3306 |

---

## Quick Start

### Prerequisites

- Node.js v18+ (installed: v24.16.0)
- Python 3.10+ (installed: 3.14.5 via `py`)
- MySQL 8 running (service: MySQL80 ✓)

---

### Step 1 — Configure Environment

**Backend `.env`** — copy and edit:
```
cd backend
copy .env.example .env
```
Edit `backend/.env`:
```
DATABASE_URL=mysql+pymysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/trustsphere
GEMINI_API_KEY=        (optional — system works without it)
```

**Create the MySQL database:**
```sql
mysql -u root -p
CREATE DATABASE trustsphere CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

---

### Step 2 — Start Backend

Double-click **`start-backend.bat`** or run manually:

```bat
cd backend
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
py init_db.py --seed
uvicorn app.main:app --reload --port 8000
```

---

### Step 3 — Start Frontend

Double-click **`start-frontend.bat`** or run manually:

```bat
cd frontend
npm install
npm run dev
```

---

### Step 4 — Start Prisma Studio (optional)

Double-click **`start-prisma-studio.bat`** or run manually:

```bat
cd backend
npm install prisma @prisma/client --save-dev
npx prisma studio --schema=prisma/schema.prisma
```

---

## Modules

### SourceMark
- Upload files → SHA-256 fingerprint stored in MySQL
- Verify files → detect modifications
- `POST /api/sourcemark/upload` · `POST /api/sourcemark/verify`

### PrivyPass
- Submit credentials → selective-disclosure eligibility check
- Raw value never returned in response
- `POST /api/privypass/verify`

### TrustTest AI
- Enter any text → rule-based prompt-injection & threat detection
- Optional Gemini API for enhanced analysis
- `POST /api/trusttest/run`

### EvidenceLock
- Register files → SHA-256 + hash-chained audit log
- Verify full audit chain integrity
- `POST /api/evidencelock/register` · `POST /api/evidencelock/verify-chain`

### Trust Report
- Unified score from all four modules
- Downloadable PDF
- `GET /api/reports/trust-report` · `GET /api/reports/download-pdf`

---

## Git Submission

```bash
git add .
git commit -m "Build TrustSphere AI full-stack application"
git push origin frontend
```

---

## Database Schema

8 tables: `users`, `uploaded_files`, `file_verifications`, `privacy_credentials`,
`security_tests`, `evidence_records`, `audit_logs`, `trust_reports`

Prisma schema: `backend/prisma/schema.prisma`
SQLAlchemy models: `backend/app/models/models.py`
