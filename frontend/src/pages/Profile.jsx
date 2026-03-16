import { useState } from 'react';
import { Copy, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Profile() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const accountId = user?._id || user?.id || '';

  const handleCopy = async () => {
    if (!accountId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      window.prompt('Copy your Account ID:', accountId);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <UserRound className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Account</h1>
      </div>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-medium text-white">Your Account ID</h2>
          <p className="mt-2 text-sm text-gray-400">Share your Account ID or email with others so they can send you documents.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            readOnly
            value={accountId}
            className="input-field w-full font-mono text-sm"
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={!accountId}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="grid gap-4 rounded-lg border border-gray-700 bg-gray-900/60 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
            <p className="mt-1 text-sm text-gray-200 break-all">{user?.email || 'Unavailable'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Google ID</p>
            <p className="mt-1 text-sm text-gray-200 break-all">{user?.google_id || 'Unavailable'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Created</p>
            <p className="mt-1 text-sm text-gray-200">{user?.created_at ? new Date(user.created_at).toLocaleString() : 'Unavailable'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}