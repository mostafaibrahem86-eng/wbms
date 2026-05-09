@echo off
echo ============================================
echo   WBMS Setup - Delete old database
echo ============================================
echo.

echo [1/3] Stopping any running Node processes...
taskkill /f /im node.exe 2>nul

echo [2/3] Deleting old database and cache...
if exist "db" rmdir /s /q "db"
if exist ".next" rmdir /s /q ".next"

echo [3/3] Creating fresh database...
npx prisma db push
npx prisma generate

echo.
echo ============================================
echo   Setup complete! Run: npm run dev
echo ============================================
pause
