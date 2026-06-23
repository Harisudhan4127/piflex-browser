# PiFlex Browser - Quick Start Guide 🚀

Get up and running with PiFlex Browser in minutes!

---

## 5-Minute Setup

### Step 1: Download & Open (Easiest)

```bash
# Option A: Use the HTML standalone version (no installation needed!)
# Just download piflex-browser.html and open it in your web browser

# Option B: Download from web
curl -O https://piflex.dev/piflex-browser.html
open piflex-browser.html
```

### Step 2: Customize Homepage

1. Click **⚙️ Settings** (top right)
2. Under "Homepage" section, click the upload area
3. Select an image from your computer
4. Done! Your custom background is saved automatically

### Step 3: Add Search Engines

1. In Settings, find "Search Engines"
2. Click **"Add Search Engine"**
3. Enter details:
   - **Name**: "YouTube"
   - **URL**: `https://www.youtube.com/results?search_query={query}`
4. Click **Add**
5. Switch to it on homepage dropdown

### Step 4: Start Browsing!

- Type URL in address bar + Enter
- Use homepage search with your favorite engine
- Click quick links or add your own

---

## Installation on Raspberry Pi

### For Beginners (Recommended)

```bash
# 1. Download the HTML file
wget https://piflex.dev/piflex-browser.html

# 2. Open in default browser
xdg-open piflex-browser.html

# 3. Bookmark it for easy access
# (Ctrl+D in most browsers)
```

### For Advanced Users (Full App)

```bash
# 1. Prerequisites
sudo apt update
sudo apt install -y nodejs npm git

# 2. Clone PiFlex
git clone https://github.com/piflex/piflex-browser.git
cd piflex-browser

# 3. Install dependencies
npm install

# 4. Run it!
npm start
```

### For Production Kiosk Mode

```bash
# 1. Install PiFlex system-wide
sudo npm install -g piflex-browser

# 2. Enable autostart
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/piflex.desktop << EOF
[Desktop Entry]
Type=Application
Name=PiFlex Browser
Exec=/usr/bin/piflex --kiosk
AutostartCondition=GNOME3
EOF

# 3. Reboot and it auto-launches
sudo reboot
```

---

## Common Tasks

### 📸 Change Homepage Background

**Settings** → Homepage → Upload Image

Upload formats:
- JPG / JPEG
- PNG
- WebP
- GIF (static)

Recommended size: 1920×1080 or larger

### 🔍 Add Custom Search Engine

1. Settings → Search Engines
2. Click "Add Search Engine"
3. Examples:

| Engine | URL |
|--------|-----|
| YouTube | `https://www.youtube.com/results?search_query={query}` |
| Reddit | `https://www.reddit.com/search/?q={query}` |
| Amazon | `https://www.amazon.com/s?k={query}` |
| Twitter | `https://twitter.com/search?q={query}` |
| Stack Overflow | `https://stackoverflow.com/search?q={query}` |

4. Click **Add** → Use from homepage

### 🎨 Change Theme

1. Settings → Browser → Theme
2. Choose:
   - **Light** - Bright theme
   - **Dark** - Dark theme
   - **Auto** - Follows system

### 🏠 Make Homepage Always Show

1. Settings → Browser
2. Enable: "Show homepage on new tab"
3. Click **✓** Save

### 🗑️ Clear Data & Reset

```javascript
// Open browser DevTools (F12)
// Paste in console to clear everything:
localStorage.clear();
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+L` | Focus address bar |
| `Alt+Left` | Back |
| `Alt+Right` | Forward |
| `F5` | Reload |
| `Ctrl+,` | Settings |
| `Enter` | Search from homepage |

---

## Troubleshooting

### "Browser is slow"

1. **Close unused tabs**
   - Each tab uses ~20-30MB RAM

2. **Disable auto-play**
   - Settings → Browser → Disable auto-play videos

3. **Upgrade Raspberry Pi**
   - Pi 3B → Pi 4 recommended

### "Can't upload background image"

1. Check file format (JPG/PNG/WebP)
2. File size should be <10MB
3. Try refreshing browser (F5)
4. Clear cache: Ctrl+Shift+Del

### "Settings don't save"

1. Check browser storage is enabled
2. Browser must be in allow list:
   - Settings → Cookies & Storage
3. Try different browser (Firefox, Chromium)

### "Raspberry Pi crashes"

1. **Check temperature**
   ```bash
   vcgencmd measure_temp
   ```

2. **Enable cooling**
   - Add heatsink or fan
   - Set GPIO pin for fan control

3. **Reduce open tabs**
   - Max 10-15 tabs safely on Pi 3

4. **Increase swap**
   ```bash
   sudo fallocate -l 1G /var/swap
   sudo swapon /var/swap
   ```

---

## Performance Tips

### For Raspberry Pi 3B

- Max 5 tabs open
- Use Google/DuckDuckGo (light)
- Disable images on slow sites
- Enable reading mode

### For Raspberry Pi 4

- Max 15 tabs open
- Any search engine OK
- Full features available
- 2GB RAM recommended

### For All Pis

1. **Close browser when not in use**
2. **Disable unused services**
   ```bash
   sudo systemctl disable bluetooth
   sudo systemctl disable cups
   ```

3. **Monitor memory**
   ```bash
   free -h
   ```

4. **Enable disk cache**
   - Settings → Advanced → Disk Cache

---

## Data & Privacy

### Where Data is Stored

**Standalone HTML Version:**
- Browser's local storage (encrypted)
- IndexedDB (per-site)

**Electron App:**
```
~/.config/piflex-browser/    (Linux)
~/Library/.../piflex-browser/ (macOS)
%APPDATA%/piflex-browser/    (Windows)
```

### What's Stored

✅ **Always Stored Locally**
- Homepage background (base64)
- Search engines list
- Browser settings
- Bookmarks
- Tab state

❌ **Never Sent to Cloud**
- Browsing history (by default)
- Password data
- Personal information

### Clear Data

1. Settings → Browser → Clear Data
2. Select categories to clear
3. Click **Clear**

Or via DevTools (F12):
```javascript
// Clear everything
localStorage.clear();
// Or specific items
localStorage.removeItem('piflex-bg');
```

---

## Advanced Configuration

### Config File Location

```bash
# Find config.json
~/.config/piflex-browser/config.json

# Edit with nano
nano ~/.config/piflex-browser/config.json

# Restart for changes to take effect
killall electron
npm start
```

### Enable Debug Mode

```bash
# Start with debug logging
piflex --debug

# Monitor memory in real-time
watch -n 1 'ps aux | grep piflex'
```

### Headless Mode (No UI)

```bash
# Run browser without window (for automation)
piflex --headless --url "https://example.com"
```

---

## Next Steps

### Learn More
- 📖 Full README: `README.md`
- ⚙️ Config guide: `config.json`
- 🔌 Extension API: (coming soon)

### Customize Further
- Add more search engines
- Change theme colors (edit config.json)
- Create custom homepages with HTML
- Build extensions (SDK available)

### Get Help
- 🐛 Report bugs: GitHub Issues
- 💬 Ask questions: GitHub Discussions
- 📧 Email: support@piflex.dev

---

## Example Workflows

### Workflow 1: Kiosk Display

Use PiFlex to show static content on a screen:

```bash
# Set homepage background to your custom image
# Settings → Homepage → Upload

# Disable navigation
# config.json: "allowAddressBar": false

# Run full-screen
piflex --kiosk --url "https://dashboard.local"
```

### Workflow 2: Pi Media Center

Display web content as media:

1. Upload large background image
2. Add YouTube, Spotify, Netflix as search engines
3. Run at startup
4. Control with mouse/touchscreen

### Workflow 3: Development Testing

Test websites on Pi hardware:

```bash
# Run dev server
python -m http.server 8000

# Open in PiFlex
piflex http://localhost:8000

# Monitor resource usage
npm run debug
```

---

## System Requirements Checklist

- [ ] Raspberry Pi 3B+ or newer
- [ ] Raspberry Pi OS Bullseye or newer
- [ ] 512MB free RAM
- [ ] 256MB free disk space
- [ ] Internet connection
- [ ] Modern browser (if using HTML version)

---

## Support Matrix

| Device | HTML Version | Electron App | Recommended |
|--------|-------------|--------------|-------------|
| Pi 3A+ | ✅ Good | ⚠️ Slow | HTML version |
| Pi 3B+ | ✅ Good | ✅ OK | Electron |
| Pi 4 (1GB) | ✅ Excellent | ✅ Good | Electron |
| Pi 4 (2GB) | ✅ Excellent | ✅ Excellent | Electron |
| Pi Zero | ❌ Too slow | ❌ Not supported | N/A |
| Laptop | ✅ Excellent | ✅ Excellent | Either |
| Server | N/A | ⚠️ Headless | Headless mode |

---

**Happy browsing! 🌐**

*PiFlex Browser — Made for Raspberry Pi, works everywhere*

For the latest updates and support, visit: **https://piflex.dev**
