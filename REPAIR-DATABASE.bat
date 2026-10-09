@echo off
title Repair the portfolio database
cd /d "%~dp0"
echo.
echo  ==============================================
echo    Repair the website's database
echo  ==============================================
echo.
echo  Use this if the website shows a "Failed query" error.
echo.
echo  FIRST close the START-WEBSITE window if it is open.
echo  Your damaged database is kept (moved aside, not deleted), and the
echo  newest working backup is restored.
echo.
pause
call npm run db:repair
if errorlevel 1 (
  echo.
  echo  The repair did not finish - see the messages above.
  pause
  exit /b
)
echo.
echo  Done. Double-click START-WEBSITE to open the site again.
pause