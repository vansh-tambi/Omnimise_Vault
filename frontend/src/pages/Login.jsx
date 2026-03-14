import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function Login() {
  const { login, isAuthenticated } = useAuth();

  const handleSuccess = async (response) => {
    try {
      // response.code contains the authorization code
      await login(response.code);
    } catch (err) {
      console.error('Login failed', err);
      alert('Login failed. Please try again.');
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full card shadow-2xl border-gray-700/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-blue-500/30">
            <Shield className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 text-center">Omnimise Vault</h1>
          <p className="text-gray-400 mb-8 text-center max-w-xs">Zero-knowledge encrypted cloud storage for your sensitive documents.</p>
          
          <div className="w-full relative py-6 border-t border-gray-700">
            <div className="flex justify-center flex-col items-center gap-4 w-full">
              <span className="text-sm font-medium text-gray-400 uppercase tracking-widest">Sign in to access</span>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => console.log('Login Failed')}
                theme="filled_black"
                size="large"
                shape="rectangular"
                text="continue_with"
                width="100%"
                flow="auth-code"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
