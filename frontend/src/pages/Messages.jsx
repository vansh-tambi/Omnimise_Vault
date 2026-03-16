import { useState, useEffect } from 'react';
import api from '../services/api';
import { MessageSquare, Send, Inbox, CheckCheck, Lock } from 'lucide-react';
import { useVaultKey } from '../context/VaultKeyContext';
import { useVault } from '../hooks/useVault';
import VaultPinPrompt from '../vault/VaultPinPrompt';
import { encryptFile, decryptFile } from '../encryption/crypto';

export default function Messages() {
  const [tab, setTab] = useState('inbox'); // 'inbox' | 'sent' | 'compose'
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Compose form
  const [recipientEmail, setRecipientEmail] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);

  // Vault context for E2E encryption
  const { vaultKey } = useVaultKey();
  const { vaults } = useVault();
  const [selectedVault, setSelectedVault] = useState('');

  // Fetch user vaults on mount
  useEffect(() => {
    api.get('/vault').then(r => setSelectedVault(r.data[0]?.id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedVault && vaultKey?.[selectedVault]) {
      fetchMessages();
    }
    const interval = setInterval(() => {
      if (selectedVault && vaultKey?.[selectedVault]) {
        fetchMessages();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tab, selectedVault, vaultKey]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'sent' ? '/messages/sent' : '/messages/inbox';
      if (tab === 'compose') { setLoading(false); return; }
      const res = await api.get(endpoint);
      
      const currentVaultKey = vaultKey?.[selectedVault];
      if (!currentVaultKey) {
        setMessages([]);
        return;
      }

      // Decrypt messages
      const decryptedMsgs = await Promise.all(res.data.map(async (msg) => {
        try {
          const binaryString = atob(msg.encrypted_message);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const decryptedBuffer = await decryptFile(bytes.buffer, currentVaultKey);
          const plaintext = new TextDecoder().decode(decryptedBuffer);
          return { ...msg, content: plaintext };
        } catch (e) {
          console.error("Failed to decrypt message", e);
          return { ...msg, content: "[Encrypted Message - Unlock Vault to View]" };
        }
      }));

      setMessages(decryptedMsgs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail.trim() || !messageContent.trim()) {
      alert('Please enter a recipient email and a message.');
      return;
    }
    setSending(true);
    try {
      const currentVaultKey = vaultKey?.[selectedVault];
      if (!currentVaultKey) {
        alert("Unlock your vault first to encrypt the message.");
        setSending(false);
        return;
      }

      // Look up user by email first
      const userRes = await api.get(`/access/lookup_user?email=${encodeURIComponent(recipientEmail.trim())}`);
      const receiverId = userRes.data.user_id;

      // Encrypt the message text
      const messageBuffer = new TextEncoder().encode(messageContent.trim());
      const encryptedBuffer = await encryptFile(messageBuffer, currentVaultKey);
      
      // Convert buffer to base64 string
      const encryptedBytes = new Uint8Array(encryptedBuffer);
      let binaryString = '';
      for (let i = 0; i < encryptedBytes.byteLength; i++) {
        binaryString += String.fromCharCode(encryptedBytes[i]);
      }
      const encryptedMessageBase64 = btoa(binaryString);

      await api.post('/messages/send', { 
        receiver_id: receiverId, 
        encrypted_message: encryptedMessageBase64 
      });
      alert('Message sent!');
      setRecipientEmail('');
      setMessageContent('');
      setTab('sent');
    } catch (err) {
      if (err.response?.status === 404) {
        alert('No user found with that email address.');
      } else {
        alert('Failed to send message: ' + (err.response?.data?.detail || err.message));
      }
    } finally {
      setSending(false);
    }
  };

  const markRead = async (msgId) => {
    try {
      await api.post(`/messages/mark_read/${msgId}`);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true } : m));
    } catch (_) {}
  };

  const tabs = [
    { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-4 h-4" /> },
    { id: 'sent', label: 'Sent', icon: <CheckCheck className="w-4 h-4" /> },
    { id: 'compose', label: 'Compose', icon: <Send className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between border-b border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-gray-300" />
          <h1 className="text-2xl font-semibold text-white">Secure Messages</h1>
        </div>
        
        {vaults?.length > 0 && (
          <div className="flex gap-2 items-center">
            <Lock className="w-4 h-4 text-blue-400" />
            <select
               value={selectedVault}
               onChange={e => setSelectedVault(e.target.value)}
               className="input-field py-1 px-3 text-sm bg-gray-800"
            >
              {vaults.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedVault && !vaultKey?.[selectedVault] ? (
        <div className="pt-8">
           <VaultPinPrompt vaultId={selectedVault} onKeyDerived={() => fetchMessages()} />
        </div>
      ) : (
      <>
        {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg w-fit border border-gray-700">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMessages([]); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Compose */}
      {tab === 'compose' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-medium text-white">New Message</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              className="input-field w-full"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
            <textarea
              value={messageContent}
              onChange={e => setMessageContent(e.target.value)}
              rows={5}
              className="input-field w-full resize-none"
              placeholder="Write your message here..."
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !recipientEmail || !messageContent}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}

      {/* Inbox / Sent */}
      {tab !== 'compose' && (
        loading ? (
          <div className="text-gray-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="card text-center p-12 text-gray-400 border-dashed border-2 flex flex-col items-center gap-3">
            <MessageSquare className="w-12 h-12 text-gray-600" />
            {tab === 'inbox' ? 'No messages in your inbox.' : 'No sent messages yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => tab === 'inbox' && !msg.read && markRead(msg.id)}
                className={`card p-4 border-l-4 cursor-pointer transition hover:bg-gray-800/70 ${
                  !msg.read && tab === 'inbox' ? 'border-l-blue-500 bg-blue-500/5' : 'border-l-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {!msg.read && tab === 'inbox' && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-blue-400">
                      {tab === 'inbox' ? `From: ${msg.sender_id}` : `To: ${msg.receiver_id}`}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.sent_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-200 bg-gray-900/50 p-3 rounded-md border border-gray-700 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )
      )}
      </>
      )}
    </div>
  );
}
