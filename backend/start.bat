@echo off
echo 🚀 Starting Dojak API Server...
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  .env file not found. Please create one based on .env.example
    echo.
    echo Example .env content:
    echo PORT=3001
    echo DOGECOIN_RPC_URL=http://localhost:33889
    echo DOGECOIN_RPC_USER=dogecoinrpc
    echo DOGECOIN_RPC_PASS=your_actual_rpc_password
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo ✅ Starting server...
npm run dev
