@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   GTU Gozetmenlik Sistemi - Otomatik Testler
echo   (Tahmin motoru + Adalet Simulatoru)
echo ========================================================
echo.
node --test "tests/*.test.js"
if errorlevel 1 (
    echo.
    echo [X] BAZI TESTLER BASARISIZ - degisiklikleri yayinlamadan once kontrol edin.
) else (
    echo.
    echo [OK] Tum testler basarili.
)
echo.
pause
