#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "======================================================="
echo "Starting Flipkart T-Shirt Listing Automation"
echo "======================================================="

# 1. Virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# 2. Dependencies
echo "Checking dependencies..."
pip install -q -r requirements.txt
pip install -q -e .

# 3. Frontend build
if [ ! -f "frontend/dist/index.html" ]; then
    echo "Building frontend static assets..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

# 4. Open browser
(sleep 2 && (which xdg-open > /dev/null && xdg-open http://127.0.0.1:8000 || open http://127.0.0.1:8000)) &

# 5. Start Uvicorn
echo "Starting server on http://127.0.0.1:8000..."
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
