@echo off
title Thavanesh Portfolio - keep this window open
cd /d "%~dp0"

echo.
echo  ==============================================
echo    Thavanesh Nagarajan - Portfolio + CMS
echo  ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed on this computer.
  echo  Your browser will open the download page. Install the "LTS" version,
  echo  then double-click START-WEBSITE again.
  start https://nodejs.org
  pause
  exit /b
)

if not exist node_modules (
  echo  First-time setup: downloading the website's parts.
  echo  This needs internet and takes a few minutes. Please wait...
  echo.
  call npm install
  if errorlevel 1 goto :fail
)

if not exist .data\db.tar.gz if not exist .data\pglite (
  echo  Setting up the database with your projects...
  call npm run db:seed
  if errorlevel 1 goto :fail
)

echo.
echo  Starting the website...
echo  Your browser will open in a few seconds.
echo.
echo    Website:   http://localhost:3000
echo    CMS:       http://localhost:3000/admin
echo.
echo  KEEP THIS WINDOW OPEN while you use the website.
echo  To stop the website, close this window.
echo.

start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000"
call npm run dev
goto :eof

:fail
echo.
echo  Something went wrong - see the messages above.
echo  Make sure you are connected to the internet for the first run.
pause
