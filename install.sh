#!/usr/bin/env bash

# ==========================================================
# PiFlex Browser Installer
# Optimized for Raspberry Pi (Debian-based distributions)
# ==========================================================

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}           PiFlex Browser Installer                 ${NC}"
echo -e "${GREEN}      Optimized for Raspberry Pi 3 B+ / 1GB RAM      ${NC}"
echo -e "${GREEN}====================================================${NC}"

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}Error: This script is intended to run on Linux (Raspberry Pi OS).${NC}"
    exit 1
fi

# Ensure git is available
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Git not found. Installing Git...${NC}"
    sudo apt-get update && sudo apt-get install -y git
fi

# 1. Update Packages & Install Required Chromium / Electron Dependencies
echo -e "\n${YELLOW}[1/4] Installing system dependencies for Electron...${NC}"
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
    build-essential

# 2. Check Node.js and npm installation
echo -e "\n${YELLOW}[2/4] Verifying Node.js and npm...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not detected. Installing Node.js LTS via NodeSource...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
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
Comment=Lightweight web browser optimized for Raspberry Pi
Exec=npm start --prefix $APP_PATH
Icon=web-browser
Terminal=false
Type=Application
Categories=Network;WebBrowser;"

# Write local applications menu shortcut
mkdir -p ~/.local/share/applications
echo "$DESKTOP_ENTRY" > ~/.local/share/applications/piflex-browser.desktop
chmod +x ~/.local/share/applications/piflex-browser.desktop

# Write desktop shortcut if Desktop exists
if [ -d "~/Desktop" ]; then
    echo "$DESKTOP_ENTRY" > ~/Desktop/piflex-browser.desktop
    chmod +x ~/Desktop/piflex-browser.desktop
fi

# Final message
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 PiFlex Browser Installation Complete!           ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "You can start the browser by running:"
echo -e "  ${YELLOW}npm start${NC} (inside the directory)"
echo -e "Or double-click the PiFlex Browser shortcut in your Menu."
echo -e "\n${YELLOW}To run in Kiosk Mode (useful for smart displays/dashboards):${NC}"
echo -e "  Add --kiosk to your app launch command, or configure your X11 startup settings."
echo -e "===================================================="
