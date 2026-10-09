@echo off
title Update my Desktop portfolio
setlocal
set "SRC=%~dp0"
set "DEST=%USERPROFILE%\Desktop\portfolio"
if /i "%SRC%"=="%DEST%\" (
  echo  This file updates your Desktop copy FROM the "Portfolio (latest from Claude)" folder.
  echo  Open that shortcut on your Desktop and run UPDATE-MY-DESKTOP-COPY from there.
  pause
  exit /b
)
echo.
echo  Copies the newest website code to:  %DEST%
echo.
echo  Your content is NOT touched: .data (database), storage (uploads),
echo  .env.local (login), node_modules and .next are skipped.
echo.
echo  FIRST close the START-WEBSITE window if it is open.
echo.
pause
robocopy "%SRC%." "%DEST%" /E /XD .data storage node_modules .next .git /XF .env.local /NFL /NDL /NJH /NP
if errorlevel 8 (
  echo  Copy failed - see above.
  pause
  exit /b
)
echo.
echo  Updated. If the website complains about missing parts, delete the
echo  node_modules folder in %DEST% and START-WEBSITE will reinstall it.
echo  Then double-click START-WEBSITE in %DEST%.
pause