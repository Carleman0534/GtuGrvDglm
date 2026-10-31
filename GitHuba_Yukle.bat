@echo off
chcp 65001 >nul
title GTU GOZETMENLIK - GITHUB YUKLEME ARACI
color 0A

echo ========================================================
echo   GTU GOZETMENLIK - GITHUB YUKLEME ARACI
echo ========================================================
echo.
echo Depo: https://github.com/Carleman0534/GtuGrvDglm.git
echo.
echo Kodlar GitHub'a gonderiliyor...
echo.

set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%LOCALAPPDATA%\Programs\GCM;%PATH%"

cd /d "%~dp0"

git add index.html sw.js logic.js app.js veri_koruma.js style.css .gitignore GitHuba_Yukle.bat
git commit -m "update: guncel kodlar ve koruma katmani" >nul 2>&1
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo ========================================================
    echo   TEBRIKLER! Tum dosyalar GitHub'a basariyla yuklendi!
    echo ========================================================
) else (
    color 0C
    echo ========================================================
    echo   Bir hata olustu veya gonderilecek yeni degisiklik yok.
    echo ========================================================
)
echo.
pause
