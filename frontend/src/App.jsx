import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { VaultKeyProvider } from './context/VaultKeyContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vault from './pages/Vault';
import Requests from './pages/Requests';
import Access from './pages/Access';
import Messages from './pages/Messages';
import DigiLockerImport from './pages/DigiLockerImport';
import AuditLog from './pages/AuditLog';
import Profile from './pages/Profile';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <VaultKeyProvider>
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
          <Navbar />
          <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/vault/:id" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
              <Route path="/access" element={<ProtectedRoute><Access /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/digilocker-import" element={<ProtectedRoute><DigiLockerImport /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </VaultKeyProvider>
    </BrowserRouter>
  );
}
