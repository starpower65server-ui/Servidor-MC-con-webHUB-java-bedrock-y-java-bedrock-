# ==================================================================
#   MC Server Manager -- Auto-Instalador (Windows)
#   Descarga e instala todo desde GitHub automáticamente
#
#   CÓMO EJECUTAR:
#   Abre PowerShell como Administrador y pega este comando:
#
#   irm https://raw.githubusercontent.com/starpower65server-ui/Servidor-MC-con-webHUB-java-bedrock-y-java-bedrock-/main/setup-windows.ps1 | iex
#
# ==================================================================

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/starpower65server-ui/Servidor-MC-con-webHUB-java-bedrock-y-java-bedrock-.git"
$InstallDir = "$env:USERPROFILE\mc-manager"

Write-Host ""
Write-Host "  +-----------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |   Minecraft Server Manager -- Auto-Instalador Windows     |" -ForegroundColor Cyan
Write-Host "  +-----------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

# ─── Helper ──────────────────────────────────────────────────────
function Fail($msg) {
    Write-Host ""
    Write-Host "[X] ERROR: $msg" -ForegroundColor Red
    Write-Host ""
    Read-Host "Pulsa Enter para salir"
    Exit 1
}

# ─── Comprobación de Administrador ───────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "  [!] AVISO: No se está ejecutando como Administrador." -ForegroundColor Yellow
    Write-Host "      Las reglas de Firewall se omitirán." -ForegroundColor Yellow
    Write-Host "      Para una instalación completa, abre PowerShell como Administrador." -ForegroundColor Yellow
    Write-Host ""
}

# ─── 1. Comprobar / Instalar Node.js ─────────────────────────────
Write-Host "[1/6] Comprobando Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [!] Node.js no instalado. Instalando via winget..." -ForegroundColor Red
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    else {
        Write-Host "  [X] winget no disponible. Instala Node.js desde https://nodejs.org/ y vuelve a ejecutar este script." -ForegroundColor Red
        Read-Host "Pulsa Enter para salir"
        Exit 1
    }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js instalado pero no accesible. Reinicia PowerShell y vuelve a ejecutar el script."
}
Write-Host "  [OK] Node.js: $(node -v)" -ForegroundColor Green

# ─── 2. Comprobar / Instalar Git ─────────────────────────────────
Write-Host "[2/6] Comprobando Git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "  [!] Git no instalado. Instalando via winget..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id Git.Git --silent --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    else {
        Fail "winget no disponible. Instala Git desde https://git-scm.com/ y vuelve a ejecutar."
    }
}
Write-Host "  [OK] Git detectado." -ForegroundColor Green

# ─── 3. Clonar / Actualizar repositorio ──────────────────────────
Write-Host "[3/6] Descargando el proyecto desde GitHub..." -ForegroundColor Yellow
if (Test-Path "$InstallDir\.git") {
    Write-Host "  [*] Carpeta existente encontrada. Actualizando..." -ForegroundColor Gray
    Set-Location $InstallDir
    git pull
    if ($LASTEXITCODE -ne 0) { Fail "No se pudo actualizar el repositorio." }
}
else {
    git clone $RepoUrl $InstallDir
    if ($LASTEXITCODE -ne 0) { Fail "No se pudo clonar el repositorio. Comprueba tu conexión a Internet." }
    Set-Location $InstallDir
}
Write-Host "  [OK] Proyecto descargado en: $InstallDir" -ForegroundColor Green

# ─── 4. Instalar dependencias ────────────────────────────────────
Write-Host "[4/6] Instalando dependencias..." -ForegroundColor Yellow

npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install (raíz) falló." }

npm install --prefix "$InstallDir\backend"
if ($LASTEXITCODE -ne 0) { Fail "npm install (backend) falló." }

npm install --prefix "$InstallDir\frontend"
if ($LASTEXITCODE -ne 0) { Fail "npm install (frontend) falló." }

Write-Host "  [OK] Dependencias instaladas." -ForegroundColor Green

# ─── 5. Compilar Frontend ────────────────────────────────────────
Write-Host "[5/6] Compilando frontend..." -ForegroundColor Yellow
Set-Location "$InstallDir\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Fail "La compilación del frontend falló." }
Set-Location $InstallDir
Write-Host "  [OK] Frontend compilado." -ForegroundColor Green

# ─── 6. Firewall ─────────────────────────────────────────────────
Write-Host "[6/6] Configurando Firewall de Windows..." -ForegroundColor Yellow
if ($isAdmin) {
    try {
        New-NetFirewallRule -DisplayName "MC Manager Panel (4000 TCP)"        -Direction Inbound -Protocol TCP -LocalPort 4000        -Action Allow -ErrorAction SilentlyContinue | Out-Null
        New-NetFirewallRule -DisplayName "Minecraft Java (25565-25585 TCP)"   -Direction Inbound -Protocol TCP -LocalPort 25565-25585 -Action Allow -ErrorAction SilentlyContinue | Out-Null
        New-NetFirewallRule -DisplayName "Minecraft Bedrock (19132 UDP)"      -Direction Inbound -Protocol UDP -LocalPort 19132        -Action Allow -ErrorAction SilentlyContinue | Out-Null
        Write-Host "  [OK] Reglas de Firewall configuradas." -ForegroundColor Green
    }
    catch {
        Write-Host "  [!] No se pudieron configurar algunas reglas: $_" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  [!] Omitido (no es Administrador). Abre los puertos 4000 TCP, 25565-25585 TCP y 19132 UDP manualmente si es necesario." -ForegroundColor Yellow
}

# ─── Fin ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ===========================================================" -ForegroundColor Green
Write-Host "  Instalacion completada!" -ForegroundColor Green
Write-Host "  Proyecto instalado en: $InstallDir" -ForegroundColor Gray
Write-Host ""
Write-Host "  COMO ARRANCAR EL SERVIDOR:" -ForegroundColor White
Write-Host "    Abre PowerShell en la carpeta del proyecto y ejecuta:" -ForegroundColor Gray
Write-Host "       npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "  O usa el acceso directo que puedes crear con:" -ForegroundColor Gray
Write-Host "       npm install -g pm2" -ForegroundColor Cyan
Write-Host "       pm2 start backend\src\index.js --name mc-manager" -ForegroundColor Cyan
Write-Host "       pm2 save" -ForegroundColor Cyan
Write-Host "       pm2 startup" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Panel Web: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Credenciales por defecto:" -ForegroundColor White
Write-Host "     Usuario:   admin" -ForegroundColor Yellow
Write-Host "     Contrasena: admin" -ForegroundColor Yellow
Write-Host "  ===========================================================" -ForegroundColor Green
Write-Host ""

Read-Host "Pulsa Enter para cerrar"
