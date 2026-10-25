# HCM Lite Enterprise — FastAPI Backend

Enterprise Human Capital Management backend built with FastAPI, PostgreSQL (SQLAlchemy 2.0 ORM), Azure OpenAI GPT-5.4-mini, and Azure Communication Services.

---

## 🛠️ Tech Stack
* **Language**: Python 3.12+ / 3.14+
* **Framework**: FastAPI (Asynchronous REST API)
* **ORM & Database**: SQLAlchemy 2.0 with PostgreSQL (`psycopg2-binary`)
* **Authentication**: JWT Bearer Tokens with bcrypt password hashing
* **AI Engine**: Azure OpenAI Service (`gpt-5.4-mini`)
* **Email & Communications**: Azure Communication Services (`azure-communication-email`)
* **Storage**: ImgBB API v1 for cloud organization branding assets
* **PDF Engine**: ReportLab for payslip generation

---

## 🚀 Quick Setup

### 1. Create Virtual Environment & Install Dependencies
```bash
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your database and cloud service credentials:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* Interactive API Documentation (Swagger UI): `http://localhost:8000/docs`
* ReDoc: `http://localhost:8000/redoc`

---

## 🧪 Automated Testing & Security Audit
Run the comprehensive 29-point QA and Cybersecurity audit suite:
```bash
python comprehensive_qa_security_test.py
```
This tests:
* Penetration defense (SQLi, IDOR, token forgery, privilege escalation)
* Camera face attendance & Haversine geofence verification
* Half-day / late loss deductions and payroll calculations
* AI Smart Leave NLP parsing (English & Roman Urdu)
