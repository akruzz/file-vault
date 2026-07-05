# File Vault

A premium, minimalist, **fully client-side** file encryption tool. File Vault encrypts and decrypts files entirely inside your browser using the native **Web Crypto API** — no server, no uploads, no network requests of any kind.

![theme](https://img.shields.io/badge/theme-black%20%26%20beige-1a1a1a) ![stack](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-E8D2A8)

---

## ✨ Features

- **100% local** — files and passwords never leave your device. There is no backend, no analytics, no third-party scripts.
- **AES-256-GCM** authenticated encryption.
- **PBKDF2** (250,000 iterations, SHA-256) key derivation with a unique random salt per file.
- **Random IV** generated for every encryption operation.
- Drag & drop or click-to-choose file selection.
- Show/hide password toggle, supports arbitrarily long passwords.
- Progress indicator, toast notifications, success animation, and clear error handling (including a dedicated "wrong password" message).
- Fully keyboard accessible.
- Responsive, centered, glass-morphism UI in a black (#000000) and beige (#E8D2A8) palette.
- Zero dependencies — pure HTML5, CSS3, and vanilla ES6 JavaScript.

---

## 📁 Project structure

```
/
├── index.html    Markup and layout
├── style.css     Visual design system (black/beige, glass cards, animations)
├── script.js     Encryption/decryption logic + UI behavior
├── icon.svg      App logo / favicon
└── README.md     This file
```

---

## 🚀 Usage

1. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari), or deploy the folder as-is to **GitHub Pages** — no build step is required.
2. **To encrypt:**
   - Drag a file into the drop zone, or click **Choose File**.
   - Enter a password.
   - Click **Encrypt File**. A `filename.ext.vault` file will download automatically.
3. **To decrypt:**
   - Drag in a `.vault` file, or click **Choose File**.
   - Enter the same password used to encrypt it.
   - Click **Decrypt File**. The original file is restored and downloaded with its original name.

If the password is incorrect, File Vault will clearly tell you rather than producing a corrupted file — this is guaranteed by AES-GCM's built-in authentication tag.

---

## 🔐 How the encryption works

Encryption uses the browser's native `crypto.subtle` implementation exclusively:

1. **Key derivation (PBKDF2):** Your password is combined with a freshly generated 16-byte random salt and stretched into a 256-bit AES key using PBKDF2-HMAC-SHA256 with 250,000 iterations. This makes brute-forcing weak passwords computationally expensive.
2. **Encryption (AES-256-GCM):** The file's raw bytes are encrypted with AES-GCM using a fresh, randomly generated 12-byte IV. GCM mode provides both confidentiality and integrity (authenticated encryption) — any tampering or password mismatch causes decryption to fail loudly instead of silently returning garbage.
3. **Packaging:** The output `.vault` file is a single binary blob laid out as:

   ```
   [4 bytes]  "FVLT" magic signature
   [1 byte]   format version
   [4 bytes]  header length (big-endian uint32)
   [N bytes]  JSON header: { filename, mimeType, salt (base64), iv (base64) }
   [...]      AES-GCM ciphertext (includes the authentication tag)
   ```

   The header stores everything required to reverse the process — including your original filename and MIME type — so decrypting fully restores the original file.
4. **Decryption** reverses these steps: it reads the header to recover the salt and IV, re-derives the key from your password with PBKDF2, and decrypts the ciphertext with AES-GCM. If the password is wrong, GCM's authentication check fails and you're shown an explicit "incorrect password" message.

Because everything runs through `window.crypto.subtle`, all cryptographic operations happen in native, audited browser code — this app never implements its own crypto primitives.

---

## 🛡️ Privacy guarantees

- No `fetch`, `XMLHttpRequest`, `WebSocket`, or any networking API is used anywhere in this codebase.
- No cookies, no `localStorage`/`sessionStorage` persistence of files or passwords.
- No external CDNs, fonts, frameworks, or analytics.
- Fully auditable: open `script.js` and verify for yourself.

---

## 🎨 Design

The interface follows a premium, minimalist aesthetic inspired by Linear, Raycast, 1Password, and Apple:

- Background: `#000000`
- Accent: `#E8D2A8`
- Text: `#FFFFFF` / secondary `#9A9A9A`
- 16px rounded corners, glass-like translucent cards, subtle shadows
- Smooth 250ms transitions and hover animations throughout
- Fully responsive down to mobile widths

---

## 🌐 Deploying to GitHub Pages

1. Push these five files to the root of a GitHub repository (or a `docs/` folder / `gh-pages` branch, per your preference).
2. In the repository settings, enable **GitHub Pages** for that branch/folder.
3. That's it — no build tools, bundlers, or configuration files are needed.

---

## 🧑‍💻 Browser support

Requires a browser with Web Crypto API support (all modern evergreen browsers: Chrome, Edge, Firefox, Safari). The Web Crypto API is only available in secure contexts (`https://` or `localhost`), which GitHub Pages satisfies automatically.

---

## License

Free to use, modify, and distribute.
