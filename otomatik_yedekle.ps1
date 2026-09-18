# GTU Matematik Gozetmenlik Sistemi - Otomatik Yedekleme Betigi
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupDir = Join-Path $scriptDir "Yedekler"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$apiUrl = "https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app/gizli_yol_gtu_admin_data.json"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$outputFile = Join-Path $backupDir "Gozetmenlik_Yedek_$timestamp.json"

Write-Host "Firebase veritabanindan guncel veriler cekiliyor..." -ForegroundColor Cyan

try {
    & curl.exe -s $apiUrl -o $outputFile
    if ((Test-Path $outputFile) -and ((Get-Item $outputFile).Length -gt 100)) {
        $fileSize = [math]::Round(((Get-Item $outputFile).Length / 1KB), 2)
        Write-Host "Basarili! Yedek kaydedildi:" -ForegroundColor Green
        Write-Host "   Dosya: $outputFile" -ForegroundColor Yellow
        Write-Host "   Boyut: $fileSize KB" -ForegroundColor Yellow
        $latestFile = Join-Path $scriptDir "firebase_backup_recovery.json"
        Copy-Item -Path $outputFile -Destination $latestFile -Force
    } else {
        Write-Host "Hata: Indirilen dosya boyutu cok kucuk!" -ForegroundColor Red
    }
} catch {
    Write-Host "Hata: Yedek alinirken hata olustu: $_" -ForegroundColor Red
}
