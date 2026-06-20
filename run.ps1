$ErrorActionPreference = "Stop"

if (-not (Test-Path "backend\data\portal_data.xlsx")) {
    python backend\scripts\seed_workbook.py
}

python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8080
