@echo off
echo ==========================================
echo  TrustSphere AI - Prisma Studio
echo ==========================================
cd /d "%~dp0backend"

if not exist "node_modules" (
    echo Installing Prisma...
    npm install prisma @prisma/client --save-dev
)

if not exist ".env" (
    echo !! .env file not found. Copy .env.example to .env and set DATABASE_URL
    pause
    exit /b 1
)

echo Starting Prisma Studio on http://localhost:5555
echo.
npx prisma studio --schema=prisma/schema.prisma
pause

