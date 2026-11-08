@echo off
echo Checking for Node.js...
node -v >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed! Please download and install Node.js 20 LTS from https://nodejs.org
  pause
  exit
)
echo Installing dependencies...
call npm install
echo Creating directories...
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "backups" mkdir backups
echo Installation complete! You can now run start.bat
pause