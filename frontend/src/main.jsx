import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { VaultKeyProvider } from './context/VaultKeyContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

// In a real app, inject via Vite env vars (import.meta.env.VITE_GOOGLE_CLIENT_ID)
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_GOES_HERE";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <VaultKeyProvider>
        <App />
      </VaultKeyProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
