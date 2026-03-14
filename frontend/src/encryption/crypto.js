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

export async function generateRSAKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return { 
    publicKeyStr: JSON.stringify(publicKeyJwk), 
    privateKeyStr: JSON.stringify(privateKeyJwk)
  };
}

export async function encryptKeyForRecipient(vaultKey, recipientPublicKeyStr) {
  const recipientPublicKeyJwk = JSON.parse(recipientPublicKeyStr);
  const publicKey = await window.crypto.subtle.importKey(
    "jwk",
    recipientPublicKeyJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["wrapKey"]
  );
  const wrappedKey = await window.crypto.subtle.wrapKey(
    "raw",
    vaultKey,
    publicKey,
    { name: "RSA-OAEP" }
  );
  return btoa(String.fromCharCode(...new Uint8Array(wrappedKey)));
}

export async function decryptKeyFromSender(encryptedKeyBase64, myPrivateKeyStr) {
  const privateKeyJwk = JSON.parse(myPrivateKeyStr);
  const privateKey = await window.crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["unwrapKey"]
  );
  const encryptedKeyBytes = new Uint8Array([...atob(encryptedKeyBase64)].map(c => c.charCodeAt(0)));
  
  return await window.crypto.subtle.unwrapKey(
    "raw",
    encryptedKeyBytes,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    false, // No longer needs to be extractable by recipient once unwrapped
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
