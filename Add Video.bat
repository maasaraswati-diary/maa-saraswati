@echo off
rem ===========================================================================
rem   ADD A VIDEO TO THE WEBSITE
rem   Maa Saraswati, Gurdaspur
rem
rem   Double-click this file. Choose your video, type what it is called, press
rem   Enter twice. The film is compressed, given a poster picture, and put on
rem   the website. There is a yes/no question before anything is published, so
rem   nothing changes without being asked for.
rem
rem   The window that opens is the whole tool. It closes when it is finished.
rem
rem   A copy of this file on the desktop works too - the project is found from
rem   either place.
rem ===========================================================================

title Add a video to the website
setlocal

rem Find the tool. The folder holding this file is tried first, so the project
rem can be moved without editing anything; the usual location is the fallback.
rem
rem Each path is written out in full rather than built by joining pieces, because
rem joining them needs a trailing backslash on the first half and forgets it once
rem and only once.
set "ADDVIDEO="
if exist "%~dp0client\scripts\add-video.mjs" set "ADDVIDEO=%~dp0client\scripts\add-video.mjs"
if not defined ADDVIDEO if exist "E:\Diary\client\scripts\add-video.mjs" set "ADDVIDEO=E:\Diary\client\scripts\add-video.mjs"

if not defined ADDVIDEO (
  echo.
  echo   The website project could not be found.
  echo.
  echo   This file looks for the project beside itself, or in E:\Diary.
  echo   Ask whoever looks after the website where the project is kept, or put
  echo   this file back in the folder it came from.
  echo.
  pause
  exit /b 1
)

rem The project root is two folders up from the script.
for %%I in ("%ADDVIDEO%") do set "ROOT=%%~dpI..\..\"
cd /d "%ROOT%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed on this computer, and this tool needs it.
  echo   Ask whoever looks after the website to install it, then try again.
  echo.
  pause
  exit /b 1
)

node "%ADDVIDEO%" %*
set "RESULT=%ERRORLEVEL%"

echo.
if "%RESULT%"=="0" (
  echo   All done. You can close this window.
) else (
  echo   Something went wrong - the message above says what.
)
pause
