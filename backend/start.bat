@echo off
echo Starting backend... start "Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload"
echo Starting frontend... start "Frontend" cmd /k "cd ../frontend && npm run dev"
@echo on
