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

export async function exportPublicKeyAsBase64(publicKey) {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function exportPrivateKeyAsBase64(privateKey) {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKeyFromBase64(base64String) {
  // Normalize base64url to standard base64 (replace - with +, _ with /) and add padding
  const normalized = base64String
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64String.length / 4) * 4, '=');
  const binaryDerString = atob(normalized);
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
  // Normalize base64url to standard base64
  const normalized = base64String
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64String.length / 4) * 4, '=');
  const binaryDerString = atob(normalized);
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
  return btoa(String.fromCharCode(...new Uint8Array(wrapped)));
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
