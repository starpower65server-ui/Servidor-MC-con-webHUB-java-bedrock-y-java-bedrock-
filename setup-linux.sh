#!/bin/bash

# ══════════════════════════════════════════════════════════════════
#   MC Server Manager — Auto-Installer (Linux / VPS)
#   Clona e instala todo desde GitHub automáticamente
#
#   USO (1 solo comando en tu VPS):
#   curl -fsSL https://raw.githubusercontent.com/starpower65server-ui/Servidor-MC-con-webHUB-java-bedrock-y-java-bedrock-/main/setup-linux.sh | bash
# ══════════════════════════════════════════════════════════════════

REPO_URL="https://github.com/starpower65server-ui/Servidor-MC-con-webHUB-java-bedrock-y-java-bedrock-.git"
INSTALL_DIR="$HOME/mc-manager"

echo ""
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║   ⛏  Minecraft Server Manager — Auto-Installer           ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo ""

# Helper: salir con mensaje de error claro
die() { echo ""; echo "❌ ERROR: $1"; echo ""; exit 1; }

# ─── 1. Instalar Node.js si no está ─────────────────────────────
echo "[1/6] Comprobando Node.js..."
if ! command -v node &> /dev/null; then
    echo "  [!] Node.js no encontrado. Instalando Node.js 20 LTS..."
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - || die "No se pudo configurar el repo de NodeSource."
        sudo apt-get install -y nodejs build-essential unzip git || die "No se pudo instalar Node.js."
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - || die "No se pudo configurar el repo de NodeSource."
        sudo yum install -y nodejs git || die "No se pudo instalar Node.js."
    else
        die "Gestor de paquetes no compatible (se necesita apt-get o yum). Instala Node.js 20+ manualmente desde https://nodejs.org/"
    fi
else
    echo "  ✓ Node.js detectado: $(node -v)"
fi

# Instalar git si no está
if ! command -v git &> /dev/null; then
    echo "  [!] Git no encontrado. Instalando..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y git || die "No se pudo instalar git."
    elif command -v yum &> /dev/null; then
        sudo yum install -y git || die "No se pudo instalar git."
    fi
fi
echo "  ✓ Git detectado: $(git --version)"

# ─── 2. Clonar / actualizar repositorio ─────────────────────────
echo "[2/6] Descargando el proyecto desde GitHub..."
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "  [*] Carpeta existente encontrada. Actualizando..."
    cd "$INSTALL_DIR"
    git pull || die "No se pudo actualizar el repositorio."
else
    git clone "$REPO_URL" "$INSTALL_DIR" || die "No se pudo clonar el repositorio. Comprueba tu conexión a Internet."
    cd "$INSTALL_DIR"
fi
echo "  ✓ Proyecto descargado en: $INSTALL_DIR"

# ─── 3. Instalar dependencias ────────────────────────────────────
echo "[3/6] Instalando dependencias..."
npm install || die "npm install (raíz) falló."
npm install --prefix "$INSTALL_DIR/backend" || die "npm install (backend) falló."
npm install --prefix "$INSTALL_DIR/frontend" || die "npm install (frontend) falló."
echo "  ✓ Dependencias instaladas."

# ─── 4. Compilar frontend ────────────────────────────────────────
echo "[4/6] Compilando frontend..."
cd "$INSTALL_DIR/frontend"
npm run build || die "La compilación del frontend falló."
cd "$INSTALL_DIR"
echo "  ✓ Frontend compilado."

# ─── 5. Configurar PM2 ──────────────────────────────────────────
echo "[5/6] Configurando PM2 para ejecución en segundo plano..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2 || die "No se pudo instalar PM2."
fi

pm2 delete mc-manager 2>/dev/null || true
pm2 start "$INSTALL_DIR/backend/src/index.js" --name mc-manager || die "No se pudo iniciar la app con PM2."
pm2 save

echo ""
echo "  ──────────────────────────────────────────────────────────"
echo "  ⚠️  ACCIÓN REQUERIDA — Activar inicio automático en el arranque:"
echo ""
echo "  Ejecuta este comando y COPIA y PEGA el resultado que aparezca:"
echo ""
echo "       pm2 startup"
echo ""
echo "  Imprimirá algo como:  sudo env PATH=... pm2 startup ..."
echo "  Copia esa línea completa y ejecútala."
echo "  ──────────────────────────────────────────────────────────"
echo ""

# ─── 6. Firewall ────────────────────────────────────────────────
echo "[6/6] Configurando reglas de firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 4000/tcp comment 'MC Manager Web Panel' 2>/dev/null || true
    sudo ufw allow 25565:25585/tcp comment 'Minecraft Java Server Ports' 2>/dev/null || true
    sudo ufw allow 19132/udp comment 'Minecraft Bedrock Server Port UDP' 2>/dev/null || true
    echo "  ✓ Reglas UFW aplicadas."
else
    echo "  [!] UFW no encontrado — abre los puertos manualmente si es necesario."
fi

# ─── Fin ─────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "TU_IP_VPS")

echo ""
echo "  ═══════════════════════════════════════════════════════════"
echo "  🎉 ¡Instalación completada con éxito!"
echo ""
echo "  👉 Panel Web: http://${PUBLIC_IP}:4000"
echo ""
echo "  🔑 Credenciales de Admin por defecto:"
echo "     - Usuario: admin"
echo "     - Contraseña: admin"
echo "     (Cámbiala al iniciar sesión por primera vez)"
echo ""
echo "  🛠️  Comandos PM2 útiles:"
echo "    - Ver logs:     pm2 logs mc-manager"
echo "    - Detener:      pm2 stop mc-manager"
echo "    - Reiniciar:    pm2 restart mc-manager"
echo "  ═══════════════════════════════════════════════════════════"
echo ""
