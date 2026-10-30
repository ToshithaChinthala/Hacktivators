@echo off
chcp 65001 > nul
echo ==========================================
echo  TrustSphere AI - Backend (FastAPI)
echo ==========================================
cd /d "%~dp0backend"

if not exist "venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    py -m venv venv
)

call venv\Scripts\activate.bat

echo Installing dependencies...
python -m pip install -r requirements.txt --prefer-binary --quiet

if not exist ".env" (
    echo.
    echo !! .env file not found. Copy .env.example to .env and set DATABASE_URL
    pause
    exit /b 1
)

echo Initializing database...
set PYTHONIOENCODING=utf-8
python init_db.py --seed

echo.
echo Starting FastAPI on http://127.0.0.1:8000
echo Swagger UI: http://127.0.0.1:8000/docs
echo.
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
