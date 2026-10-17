param(
    [string]$SdkRoot = 'D:\Android\Sdk',
    [string]$AvdName = 'Medium_Phone_API_37.0',
    [switch]$Install
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$adb = Join-Path $SdkRoot 'platform-tools/adb.exe'
if (!(Test-Path -LiteralPath $adb)) { throw "Khong tim thay adb tai $adb" }
Push-Location $projectRoot
try {
    docker compose up -d --wait --wait-timeout 180
    if ($LASTEXITCODE -ne 0) { throw 'Docker chua san sang. Hay mo Docker Desktop.' }
    $devices = & $adb devices
    $serials = @($devices | Where-Object { $_ -match '^emulator-\d+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if ($serials.Count -gt 1) { throw 'Dang co nhieu may ao. Hay chi de mo mot may ao Android.' }
    if ($serials.Count -eq 0) {
        $existing = & $adb devices | Where-Object { $_ -match '^emulator-\d+\s+' }
        $emulatorRunning = Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('emulator.exe','qemu-system-x86_64.exe') -and $_.CommandLine -like "*-avd $AvdName*" }
        if (!$existing -and !$emulatorRunning) {
            Start-Process -FilePath (Join-Path $SdkRoot 'emulator/emulator.exe') -ArgumentList @('-avd',$AvdName,'-no-snapshot-load','-cores','2','-feature','-Vulkan') | Out-Null
        }
        $deadline = (Get-Date).AddMinutes(6)
        do {
            Start-Sleep -Seconds 3
            $serials = @(& $adb devices | Where-Object { $_ -match '^emulator-\d+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
        } until ($serials.Count -eq 1 -or (Get-Date) -gt $deadline)
        if ($serials.Count -ne 1) { throw 'May ao chua ket noi adb. Kiem tra Device Manager.' }
    }
    $serial = $serials[0]
    $deadline = (Get-Date).AddMinutes(6)
    do {
        $booted = (& $adb -s $serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
        if ($booted -ne '1') { Start-Sleep -Seconds 3 }
    } until ($booted -eq '1' -or (Get-Date) -gt $deadline)
    if ($booted -ne '1') { throw 'Android chua khoi dong xong.' }
    & $adb -s $serial reverse tcp:8081 tcp:8081
    if ($LASTEXITCODE -ne 0) { throw 'Khong noi duoc API voi may ao.' }
    if ($Install) {
        $apk = Join-Path $projectRoot '.local/android/halora-local-x86_64.apk'
        if (!(Test-Path -LiteralPath $apk)) { throw 'Chua co APK. Chay pnpm android:build:local truoc.' }
        & $adb -s $serial install -r $apk
        if ($LASTEXITCODE -ne 0) { throw 'Cai APK that bai.' }
    }
    $installed = & $adb -s $serial shell pm path com.halora.mobile
    if (!($installed -match '^package:')) { throw 'Chua cai Halora. Chay pnpm android:install:local.' }
    & $adb -s $serial shell am start -n com.halora.mobile/.MainActivity
    if ($LASTEXITCODE -ne 0) { throw 'Khong mo duoc Halora. Chay pnpm android:install:local de cai app.' }
} finally { Pop-Location }
