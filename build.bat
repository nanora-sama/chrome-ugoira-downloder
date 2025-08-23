@echo off
REM Chrome Ugoira Downloader Build Script for Windows

echo Building Chrome Ugoira Downloader...

REM Clean previous build
echo Cleaning previous build...
call npm run clean

REM Install dependencies
echo Installing dependencies...
call npm install

REM Build the extension
echo Building extension...
call npm run build

REM Check if build was successful
if exist "dist\" (
    echo.
    echo Build successful! Extension is ready in the 'dist' folder.
    echo.
    echo Next steps:
    echo 1. Open Chrome and go to chrome://extensions/
    echo 2. Enable 'Developer mode'
    echo 3. Click 'Load unpacked'
    echo 4. Select the 'dist' folder
) else (
    echo.
    echo Build failed. Please check the error messages above.
    exit /b 1
)