# SessionPocket 🗂️

> **One browser. Multiple isolated web sessions.**

SessionPocket is a production-ready, local-first Manifest V3 Chrome Extension that enables users to maintain multiple independent sessions and accounts for any website (e.g. WhatsApp, Instagram, YouTube, and arbitrary web apps) from a single browser profile.

---

## ✨ Features

- **Multi-Account Session Management**: Maintain independent sessions (Personal, Work, Creator, Client, Alt) for any website.
- **Deep Session State Vault**: Captures all layers of modern web application state:
  - **Cookies**: Exact URL, domain, and apex domain cookies (including `Secure`, `HttpOnly`, `SameSite`, and MV3 `PartitionKey`).
  - **LocalStorage**: Complete origin key-value state.
  - **SessionStorage**: In-memory tab storage.
  - **IndexedDB**: Crucial for WhatsApp Web and modern PWAs where cryptographic keys and authentication tokens are persisted in IndexedDB.
- **Atomic Session Swapping**: Clean domain sanitization and state injection when switching accounts, preventing stale token conflicts or session bleeding.
- **Dual-Context Isolation (Incognito Support)**: Launch any session directly into an isolated Incognito context (`storeId: 1`) to run two independent accounts side-by-side concurrently!
- **Keyboard-First Quick Switcher (⌘K / Ctrl+K)**: Instant command palette for lightning-fast search and session launching.
- **Active Session Tracking & Icon Badge**: Shows which session pocket is active on the current domain right on the extension icon.
- **Auto-Sync on Switch**: Automatically captures rolling session tokens before switching pockets so you never get logged out.
- **100% Local-First & Zero Telemetry**: Sensitive session data stays strictly inside your browser's `chrome.storage.local`. No external servers, no tracking, and no credentials logged.
- **Backup & Portability**: 1-click JSON export and import for easy backup and cross-device migration.

---

## 🛠️ Tech Stack

- **Framework**: [CRXJS](https://crxjs.dev/vite-plugin) + [Vite](https://vite.dev/) (Manifest V3)
- **Language**: TypeScript
- **UI & Styling**: React 18, Tailwind CSS, [Lucide React](https://lucide.dev/)
- **Validation**: [Zod](https://zod.dev/)
- **Package Manager**: pnpm

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8 (or npm)

### Installation

```bash
pnpm install
```

### Development Mode

```bash
pnpm dev
```

Load the unpacked extension in Chrome:

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist` directory

### Production Build

```bash
pnpm build
```

The production-ready extension package will be compiled into:

```
dist/
```

### Run Tests & Typechecking

```bash
# Run unit test suite
pnpm test

# Run TypeScript compiler checks
pnpm typecheck
```

---

## 🔒 Security & Privacy Architecture

1. **Least-Privilege Permissions**:
   - `cookies`: Read/write session cookies.
   - `storage` & `unlimitedStorage`: Persistent local vault.
   - `tabs` & `activeTab`: Target navigation and tab recognition.
   - `scripting`: On-demand injection for storage capture and restoration in the target tab.
   - Host permissions: `https://*/*` and `http://*/*`.
2. **Local-First**: All session state is saved exclusively in `chrome.storage.local`. There is no remote backend, telemetry, analytics, or third-party tracking.
3. **No Credential Logging**: Passwords, tokens, and cookie values are never logged to `console` or stored outside the browser's protected extension sandbox.

---

## 📋 License

MIT © Jenil Sheth
