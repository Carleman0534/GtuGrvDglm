@echo off
chcp 65001 >nul
echo ========================================================
echo   GTU Matematik Gozetmenlik Sistemi - Yedek Alma Araci
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0otomatik_yedekle.ps1"
echo.
echo Islem tamamlandi.
timeout /t 5
