@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Starting Flipkart T-Shirt Listing Automation
echo =======================================================

cd /d "%~dp0"

REM 1. Check Python virtual environment
if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate

REM 2. Install Python dependencies
echo Checking dependencies...
python -m pip install -q -r requirements.txt
python -m pip install -q -e .

REM 3. Check frontend dist build
if not exist "frontend\dist\index.html" (
    echo Building frontend web interface...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

REM 4. Launch browser after a 2-second delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000"

REM 5. Start Uvicorn backend server
echo Starting server on http://127.0.0.1:8000...
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
