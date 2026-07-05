'use strict';

/* =========================================================
   File Vault — script.js
   All encryption/decryption happens locally using the
   Web Crypto API. No network requests are ever made.
   ========================================================= */

/* ---------- Constants ---------- */

const MAGIC = 'FVLT';               // 4-byte file signature identifying a .vault file
const FORMAT_VERSION = 1;           // bumped if the on-disk layout ever changes
const PBKDF2_ITERATIONS = 250000;   // strong, modern iteration count
const SALT_LENGTH = 16;             // bytes
const IV_LENGTH = 12;               // bytes, standard for AES-GCM
const AES_KEY_LENGTH = 256;         // bits

/* ---------- DOM references ---------- */

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const dropZoneEmpty = document.getElementById('dropZoneEmpty');
const dropZoneFile = document.getElementById('dropZoneFile');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFileBtn');

const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const eyeIcon = document.getElementById('eyeIcon');

const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');

const encryptBtn = document.getElementById('encryptBtn');
const decryptBtn = document.getElementById('decryptBtn');

const toastContainer = document.getElementById('toastContainer');

/* ---------- Application state ---------- */

let selectedFile = null; // the File object currently loaded into the drop zone

/* =========================================================
   File selection & drag/drop handling
   ========================================================= */

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Update the UI to reflect the currently selected file (or lack thereof). */
function setSelectedFile(file) {
  selectedFile = file;

  if (!file) {
    dropZoneEmpty.classList.remove('hidden');
    dropZoneFile.classList.add('hidden');
    fileInput.value = '';
    return;
  }

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatFileSize(file.size);
  dropZoneEmpty.classList.add('hidden');
  dropZoneFile.classList.remove('hidden');
}

chooseFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener('click', () => {
  if (!selectedFile) fileInput.click();
});

dropZone.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !selectedFile) {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    setSelectedFile(fileInput.files[0]);
  }
});

removeFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setSelectedFile(null);
});

// Drag & drop highlighting
['dragenter', 'dragover'].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-active');
  });
});

['dragleave', 'dragend'].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-active');
  });
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-active');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) setSelectedFile(file);
});

/* =========================================================
   Password field show/hide
   ========================================================= */

togglePasswordBtn.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  togglePasswordBtn.setAttribute('aria-pressed', String(isHidden));
  togglePasswordBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');

  // Swap the eye icon between "open" and "slashed" states
  eyeIcon.innerHTML = isHidden
    ? '<path d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.5 5.2A10.6 10.6 0 0112 5c7 0 10.5 7 10.5 7a15.7 15.7 0 01-3.94 4.6M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7a10.5 10.5 0 004.9-1.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.4"/>';
});

/* =========================================================
   Toast notifications
   ========================================================= */

/**
 * Show a toast message.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 220);
  }, 3600);
}

/* =========================================================
   Progress indicator helpers
   ========================================================= */

function showProgress(label, percent) {
  progressWrap.classList.remove('hidden');
  progressLabel.textContent = label;
  progressFill.style.width = `${percent}%`;
}

function hideProgress() {
  progressWrap.classList.add('hidden');
  progressFill.style.width = '0%';
}

function setButtonsDisabled(disabled) {
  encryptBtn.disabled = disabled;
  decryptBtn.disabled = disabled;
}

/* =========================================================
   Cryptography helpers (Web Crypto API)
   ========================================================= */

/**
 * Derive a 256-bit AES-GCM key from a password and salt using PBKDF2.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Concatenate multiple Uint8Array/ArrayBuffer chunks into a single Uint8Array. */
function concatBuffers(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** Write a 32-bit unsigned integer (big-endian) as a 4-byte Uint8Array. */
function uint32ToBytes(value) {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value, false);
  return buf;
}

/** Read a 32-bit unsigned integer (big-endian) from a Uint8Array at the given offset. */
function bytesToUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

/**
 * Encrypt a File using AES-256-GCM with a PBKDF2-derived key.
 * Produces a self-describing .vault binary blob containing everything
 * needed to decrypt it later (salt, iv, original filename, mime type).
 *
 * @param {File} file
 * @param {string} password
 * @param {(percent:number,label:string)=>void} onProgress
 * @returns {Promise<Blob>}
 */
async function encryptFile(file, password, onProgress) {
  onProgress(10, 'Reading file…');
  const fileBuffer = await file.arrayBuffer();

  onProgress(30, 'Deriving encryption key…');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  onProgress(55, 'Encrypting data…');
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  );

  onProgress(80, 'Packaging vault file…');

  // Header carries everything required to reverse the process later.
  const header = {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));

  const magicBytes = new TextEncoder().encode(MAGIC);
  const versionByte = new Uint8Array([FORMAT_VERSION]);
  const headerLengthBytes = uint32ToBytes(headerBytes.byteLength);

  const finalBytes = concatBuffers([
    magicBytes,
    versionByte,
    headerLengthBytes,
    headerBytes,
    new Uint8Array(ciphertext),
  ]);

  onProgress(100, 'Done');
  return new Blob([finalBytes], { type: 'application/octet-stream' });
}

/**
 * Decrypt a .vault file previously produced by encryptFile().
 *
 * @param {File} file
 * @param {string} password
 * @param {(percent:number,label:string)=>void} onProgress
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
async function decryptFile(file, password, onProgress) {
  onProgress(10, 'Reading vault file…');
  const buffer = new Uint8Array(await file.arrayBuffer());

  const magicText = new TextDecoder().decode(buffer.slice(0, 4));
  if (magicText !== MAGIC) {
    throw new Error('NOT_A_VAULT_FILE');
  }

  const version = buffer[4];
  if (version !== FORMAT_VERSION) {
    throw new Error('UNSUPPORTED_VERSION');
  }

  const headerLength = bytesToUint32(buffer, 5);
  const headerStart = 9;
  const headerEnd = headerStart + headerLength;

  if (headerEnd > buffer.byteLength) {
    throw new Error('CORRUPTED_FILE');
  }

  let header;
  try {
    const headerText = new TextDecoder().decode(buffer.slice(headerStart, headerEnd));
    header = JSON.parse(headerText);
  } catch (err) {
    throw new Error('CORRUPTED_FILE');
  }

  const salt = base64ToBuffer(header.salt);
  const iv = base64ToBuffer(header.iv);
  const ciphertext = buffer.slice(headerEnd);

  onProgress(35, 'Deriving decryption key…');
  const key = await deriveKey(password, salt);

  onProgress(65, 'Decrypting data…');
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  } catch (err) {
    // AES-GCM authentication failure surfaces here — almost always a wrong password.
    throw new Error('WRONG_PASSWORD');
  }

  onProgress(95, 'Restoring file…');
  const blob = new Blob([plaintext], { type: header.mimeType || 'application/octet-stream' });

  onProgress(100, 'Done');
  return { blob, filename: header.filename || 'decrypted-file' };
}

/* ---------- Base64 helpers (for embedding binary salt/iv in JSON) ---------- */

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/* =========================================================
   Download helper
   ========================================================= */

/** Trigger a browser download for a Blob, without any network involvement. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Release the object URL shortly after the download has been handed off.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   Button handlers
   ========================================================= */

function flashSuccess() {
  const card = document.querySelector('.card');
  card.classList.add('success-flash');
  setTimeout(() => card.classList.remove('success-flash'), 750);
}

function validateBeforeRun() {
  if (!selectedFile) {
    showToast('Please choose a file first.', 'error');
    return false;
  }
  if (!passwordInput.value) {
    showToast('Please enter a password.', 'error');
    passwordInput.focus();
    return false;
  }
  return true;
}

encryptBtn.addEventListener('click', async () => {
  if (!validateBeforeRun()) return;

  const password = passwordInput.value;
  const file = selectedFile;

  setButtonsDisabled(true);
  showProgress('Starting encryption…', 5);

  try {
    const blob = await encryptFile(file, password, (percent, label) => showProgress(label, percent));
    downloadBlob(blob, `${file.name}.vault`);
    flashSuccess();
    showToast(`Encrypted "${file.name}" successfully.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Encryption failed. Please try again.', 'error');
  } finally {
    setButtonsDisabled(false);
    setTimeout(hideProgress, 600);
  }
});

decryptBtn.addEventListener('click', async () => {
  if (!validateBeforeRun()) return;

  const file = selectedFile;
  const password = passwordInput.value;

  if (!file.name.toLowerCase().endsWith('.vault')) {
    showToast('That doesn\u2019t look like a .vault file.', 'error');
    return;
  }

  setButtonsDisabled(true);
  showProgress('Starting decryption…', 5);

  try {
    const { blob, filename } = await decryptFile(file, password, (percent, label) => showProgress(label, percent));
    downloadBlob(blob, filename);
    flashSuccess();
    showToast(`Decrypted "${filename}" successfully.`, 'success');
  } catch (err) {
    console.error(err);
    if (err.message === 'WRONG_PASSWORD') {
      showToast('Incorrect password. Please try again.', 'error');
    } else if (err.message === 'NOT_A_VAULT_FILE') {
      showToast('This file was not created by File Vault.', 'error');
    } else if (err.message === 'UNSUPPORTED_VERSION') {
      showToast('This vault file was created with an unsupported version.', 'error');
    } else if (err.message === 'CORRUPTED_FILE') {
      showToast('This vault file appears to be corrupted.', 'error');
    } else {
      showToast('Decryption failed. Please try again.', 'error');
    }
  } finally {
    setButtonsDisabled(false);
    setTimeout(hideProgress, 600);
  }
});

/* =========================================================
   Keyboard accessibility niceties
   ========================================================= */

// Allow pressing Enter inside the password field to trigger encryption by default.
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    encryptBtn.click();
  }
});

// Warn the user before leaving the page if a file is loaded but not yet processed,
// to avoid accidental loss of context (purely a UX nicety, no data is ever stored).
window.addEventListener('beforeunload', (e) => {
  if (selectedFile) {
    e.preventDefault();
    e.returnValue = '';
  }
});
