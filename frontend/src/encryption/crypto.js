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
    false,
    ["encrypt", "decrypt"]
  )
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
