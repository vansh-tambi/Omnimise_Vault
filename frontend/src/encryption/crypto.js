// frontend/src/encryption/crypto.js

export async function deriveKey(pin, salt) {
  const enc = new TextEncoder()

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    true, // Must be true so it can be wrapped/shared via RSA
    ["encrypt", "decrypt"]
  )
}

export async function hashPIN(pin, saltBytes) {
  // Use the same algorithm as backend: PBKDF2-SHA256 100k iterations, 32 bytes, exported as base64
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256 // 32 bytes
  );
  // Encode to base64 — same as what Python's base64.b64encode produces
  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
}

export async function generateRSAKeyPair() {
  return await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["wrapKey", "unwrapKey"]
  );
}

// Safe base64 encode for potentially large buffers (avoids spread stack overflow)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function exportPublicKeyAsBase64(publicKey) {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

export async function exportPrivateKeyAsBase64(privateKey) {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  return arrayBufferToBase64(exported);
}

export async function importPublicKeyFromBase64(base64String) {
  // Strip PEM headers/footers if present, then all whitespace
  const stripped = base64String
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');

  // Normalize base64url → standard base64
  const normalized = stripped
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Fix padding: length must be a multiple of 4
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  let binaryDerString;
  try {
    binaryDerString = atob(padded);
  } catch (e) {
    throw new Error(
      `importPublicKeyFromBase64: atob failed. First 80 chars of cleaned key: "${padded.slice(0, 80)}". Original error: ${e.message}`
    );
  }

  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["wrapKey"]
  );
}

export async function importPrivateKeyFromBase64(base64String) {
  // Strip all whitespace, then normalize base64url to standard base64, then fix padding
  const cleaned = base64String.replace(/\s/g, '');
  const normalized = cleaned
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/={0,2}$/, '');
  const padded = normalized + '=='.slice(0, (4 - normalized.length % 4) % 4);
  const binaryDerString = atob(padded);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["unwrapKey"]
  );
}

export async function wrapVaultKey(vaultKey, recipientPublicKey) {
  const wrapped = await crypto.subtle.wrapKey(
    "raw",
    vaultKey,
    recipientPublicKey,
    { name: "RSA-OAEP" }
  );
  return arrayBufferToBase64(wrapped);
}

export async function unwrapVaultKey(wrappedKeyBase64, privateKey) {
  const binaryDerString = atob(wrappedKeyBase64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  
  return await crypto.subtle.unwrapKey(
    "raw",
    binaryDer.buffer,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptFile(file, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await file.arrayBuffer()

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  )

  return { encrypted, iv }
}

export async function decryptFile(encryptedData, iv, key) {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  )
}

export async function hashFile(fileBuffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
