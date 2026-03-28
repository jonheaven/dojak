@echo off
echo 🧹 Cleaning up existing Node.js processes before build...

REM Kill other node processes (but not ourselves)
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv /nh ^| findstr /v "%~nx0"') do (
    echo Killing Node.js process %%i
    taskkill /f /pid %%i >nul 2>&1
)

echo ✅ Build environment cleaned. Starting webpack build...
npx webpack --progress --env browser=chrome manifest=mv3 config=dev channel=github version=0.1.1.1
