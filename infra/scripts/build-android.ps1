param(
    [string]$SdkRoot = 'D:\Android\Sdk',
    [string]$JavaHome = 'D:\Android\Jdk17',
    [string]$GradleCache = 'D:\Android\GradleCache'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (!(Test-Path (Join-Path $JavaHome 'bin/javac.exe'))) {
    $installed = @(Get-ChildItem -LiteralPath $JavaHome -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'bin/javac.exe') })
    if ($installed.Count -ne 1) { throw "Can JDK 17 tai $JavaHome (hoac truyen -JavaHome)." }
    $JavaHome = $installed[0].FullName
}
if (!(Test-Path (Join-Path $SdkRoot 'platforms/android-35'))) { throw 'Can Android SDK platform 35, build-tools 34.0.0/35.0.0, NDK 26.1.10909125 va CMake 3.22.1.' }
$previousJava = $env:JAVA_HOME
$previousSdk = $env:ANDROID_HOME
$previousGradle = $env:GRADLE_USER_HOME
$previousApi = $env:EXPO_PUBLIC_API_BASE_URL
$previousNodeEnv = $env:NODE_ENV
Push-Location $projectRoot
try {
    $env:JAVA_HOME = $JavaHome
    $env:ANDROID_HOME = $SdkRoot
    $env:GRADLE_USER_HOME = $GradleCache
    $env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8081/api/v1'
    $env:NODE_ENV = 'production'
    pnpm --filter '@halora/api-client' run build
    if ($LASTEXITCODE -ne 0) { throw 'Build API client that bai.' }
    pnpm --filter '@halora/mobile' exec expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild that bai.' }
    $wrapper = Join-Path $projectRoot 'apps/mobile/android/gradle/wrapper/gradle-wrapper.properties'
    $content = (Get-Content -LiteralPath $wrapper -Raw).Replace('gradle-8.10.2-all.zip', 'gradle-8.10.2-bin.zip').Replace('networkTimeout=10000', 'networkTimeout=120000')
    [IO.File]::WriteAllText($wrapper, $content)
    Push-Location (Join-Path $projectRoot 'apps/mobile/android')
    try {
        & .\gradlew.bat assembleRelease '-PreactNativeArchitectures=x86_64' '-Pkotlin.compiler.execution.strategy=in-process' '-Porg.gradle.java.installations.auto-detect=false' "-Porg.gradle.java.installations.paths=$JavaHome" '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8' --max-workers=2 --no-daemon --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Build APK that bai.' }
    } finally { Pop-Location }
    $output = Join-Path $projectRoot '.local/android'
    New-Item -ItemType Directory -Force -Path $output | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk') -Destination (Join-Path $output 'halora-local-x86_64.apk')
    Write-Host "APK may ao Android: $output\halora-local-x86_64.apk"
} finally {
    Pop-Location
    $env:JAVA_HOME = $previousJava
    $env:ANDROID_HOME = $previousSdk
    $env:GRADLE_USER_HOME = $previousGradle
    $env:EXPO_PUBLIC_API_BASE_URL = $previousApi
    $env:NODE_ENV = $previousNodeEnv
}
