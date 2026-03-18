import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { generateRSAKeyPair, exportPublicKeyAsBase64, exportPrivateKeyAsBase64 } from '../encryption/crypto';

export default function Login() {
  const { login, isAuthenticated } = useAuth();

  const handleSuccess = async (response) => {
    try {
      console.log('Google OAuth response:', response);

      const oauthPayload = {};
      if (response.credential) {
        oauthPayload.credential = response.credential;
      } else if (response.code) {
        oauthPayload.code = response.code;
      }

      if (!oauthPayload.credential && !oauthPayload.code) {
        console.error('No auth code or credential in response', response);
        alert('Login failed: No authorization code received.');
        return;
      }

      let publicKey = localStorage.getItem('rsa_public_key');
      let privateKey = localStorage.getItem('rsa_private_key');
      
      if (!publicKey || !privateKey) {
        const keyPair = await generateRSAKeyPair();
        publicKey = await exportPublicKeyAsBase64(keyPair.publicKey);
        privateKey = await exportPrivateKeyAsBase64(keyPair.privateKey);
        localStorage.setItem('rsa_public_key', publicKey);
        localStorage.setItem('rsa_private_key', privateKey);
      }
      
      await login(oauthPayload, publicKey);
    } catch (err) {
      console.error('Login failed', err);
      alert(err.response?.data?.detail || 'Login failed. Please try again.');
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '32px',
          }}>
            <div style={{
              width: '28px', height: '28px',
              background: 'var(--accent)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="6" width="10" height="7" rx="1" fill="#0a0a0a"/>
                <path d="M4 6V4a3 3 0 016 0v2" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--text-primary)',
              letterSpacing: '0.02em',
            }}>Omnimise Vault</span>
          </div>

          <h1 style={{
            fontSize: '22px',
            fontWeight: '500',
            color: 'var(--text-primary)',
            marginBottom: '8px',
            lineHeight: '1.3',
          }}>Secure document vault</h1>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
          }}>
            End-to-end encrypted. Zero-knowledge.<br/>
            Your files never leave your browser unencrypted.
          </p>
        </div>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '16px',
        }}>
          <p style={{
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            marginBottom: '16px',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>Continue with</p>

          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => console.log('Login Failed')}
            theme="filled_black"
            size="large"
            shape="rectangular"
            text="continue_with"
            width="320"
            flow="auth-code"
            scope="openid email profile https://www.googleapis.com/auth/drive.file"
            access_type="offline"
            prompt="consent"
          />
        </div>

        <p style={{
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          AES-256-GCM · RSA-OAEP · PBKDF2 · Zero-knowledge
        </p>
      </div>
    </div>
  );
}
