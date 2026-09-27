@echo off
rem ===========================================================================
rem   ADD A VIDEO TO THE WEBSITE
rem   Maa Saraswati, Gurdaspur
rem
rem   Double-click this file. Answer three questions. The film is compressed,
rem   given a poster picture, and put on the website. Nothing is asked that
rem   needs explaining, and the website is not changed until the last step,
rem   where there is a yes/no question first.
rem
rem   The window that opens is the whole tool. It closes when it is finished.
rem ===========================================================================

title Add a video to the website
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed on this computer, and this tool needs it.
  echo   Ask whoever looks after the website to install it, then try again.
  echo.
  pause
  exit /b 1
)

node "client\scripts\add-video.mjs" %*

echo.
pause
