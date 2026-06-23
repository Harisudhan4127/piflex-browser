#!/usr/bin/env bash

# ==========================================================
# PiFlex Browser Universal Linux Installer
# Supports Debian/Ubuntu, Fedora, and Arch Linux
# ==========================================================

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}           PiFlex Browser Installer                 ${NC}"
echo -e "${GREEN}    Universal Linux Support (ARM & x86 architectures) ${NC}"
echo -e "${GREEN}====================================================${NC}"

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}Error: This script is intended to run on Linux distributions only.${NC}"
    exit 1
fi

# Detect Package Manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
else
    echo -e "${RED}Error: Supported package manager (apt, dnf, pacman) not found.${NC}"
    exit 1
fi

echo -e "${GREEN}Detected package manager: ${PKG_MANAGER}${NC}"

# 1. Install System Dependencies based on Distro
echo -e "\n${YELLOW}[1/4] Installing system dependencies for Electron/Chromium...${NC}"

case $PKG_MANAGER in
    apt)
        sudo apt-get update
        sudo apt-get install -y \
            libnss3 \
            libatk1.0-0 \
            libatk-bridge2.0-0 \
            libcups2 \
            libgtk-3-0 \
            libasound2 \
            libgbm1 \
            libxss1 \
            libxtst6 \
            libxshmfence1 \
            build-essential \
            curl \
            git
        ;;
    dnf)
        sudo dnf check-update
        sudo dnf install -y \
            nss \
            at-spi2-atk \
            cups-libs \
            gtk3 \
            alsa-lib \
            mesa-libgbm \
            libXScrnSaver \
            libXtst \
            libxshmfence \
            make \
            gcc \
            gcc-c++ \
            curl \
            git
        ;;
    pacman)
        sudo pacman -Sy
        sudo pacman -S --needed --noconfirm \
            nss \
            at-spi2-core \
            cups \
            gtk3 \
            alsa-lib \
            mesa \
            libxss \
            libxtst \
            libxshmfence \
            base-devel \
            curl \
            git
        ;;
esac

# 2. Check Node.js and npm installation
echo -e "\n${YELLOW}[2/4] Verifying Node.js and npm...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not detected. Installing Node.js & npm...${NC}"
    case $PKG_MANAGER in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        dnf)
            sudo dnf install -y nodejs npm
            ;;
        pacman)
            sudo pacman -S --noconfirm nodejs npm
            ;;
    esac
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}Node.js is already installed (${NODE_VERSION})${NC}"
fi

# 3. Install NPM Packages
echo -e "\n${YELLOW}[3/4] Installing Node.js project dependencies...${NC}"
npm install --no-audit --no-fund

# 4. Create Desktop & Launcher Shortcuts
echo -e "\n${YELLOW}[4/4] Creating launcher shortcuts...${NC}"
APP_PATH=$(pwd)
DESKTOP_ENTRY="[Desktop Entry]
Name=PiFlex Browser
Comment=Lightweight AI Web Browser optimized for Linux
Exec=npm start --prefix $APP_PATH
Icon=web-browser
Terminal=false
Type=Application
Categories=Network;WebBrowser;"

# Write local applications menu shortcut
mkdir -p ~/.local/share/applications
echo "$DESKTOP_ENTRY" > ~/.local/share/applications/piflex-browser.desktop
chmod +x ~/.local/share/applications/piflex-browser.desktop

# Write desktop shortcut if Desktop folder exists
if [ -d ~/Desktop ]; then
    echo "$DESKTOP_ENTRY" > ~/Desktop/piflex-browser.desktop
    chmod +x ~/Desktop/piflex-browser.desktop
fi

# Create Chrome Extensions folder
mkdir -p "$APP_PATH/extensions"

# Final message
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 PiFlex Browser Installation Complete!           ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "You can start the browser by running:"
echo -e "  ${YELLOW}npm start${NC} (inside the directory)"
echo -e "Or double-click the PiFlex Browser shortcut in your Menu."
echo -e "\n${YELLOW}Using the AI Assistant:${NC}"
echo -e "1. Make sure you have Ollama installed: https://ollama.com"
echo -e "2. Start Ollama and pull a lightweight model (e.g. gemma2:2b or tinydolphin):"
echo -e "   ${YELLOW}ollama run tinydolphin${NC}"
echo -e "3. Open Settings inside PiFlex and update the host if running on another local machine."
echo -e "===================================================="
