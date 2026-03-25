import { useState, useEffect } from 'react';

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE;
const STORAGE_KEY = 'gw_access_v1';

/**
 * Wraps the app with a passcode gate when VITE_ACCESS_CODE is set.
 * Remove the env var in Vercel to open the app to the public — no code changes needed.
 */
export default function AccessGate({ children }) {
  const [granted, setGranted] = useState(false);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!ACCESS_CODE) { setGranted(true); return; }
    if (localStorage.getItem(STORAGE_KEY) === ACCESS_CODE) setGranted(true);
  }, []);

  if (!ACCESS_CODE || granted) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() === ACCESS_CODE) {
      localStorage.setItem(STORAGE_KEY, ACCESS_CODE);
      setGranted(true);
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: 'var(--bg)',
      gap: 24,
      padding: 24,
    }}>
      <img src="/icons/logo.png" alt="GardaWind" style={{ width: 64, height: 64, opacity: 0.9 }} />

      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 300 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          GardaWind
        </div>
        <div style={{ fontSize: 13 }}>
          This app is in private testing.<br />Enter your access code to continue.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        maxWidth: 260,
        animation: shake ? 'gw-shake 0.4s ease' : 'none',
      }}>
        <input
          autoFocus
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Access code"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${shake ? '#ef4444' : 'var(--border)'}`,
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 16,
            padding: '10px 14px',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '0.1em',
            transition: 'border-color 0.15s',
          }}
        />
        <button
          type="submit"
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            padding: '10px 0',
          }}
        >
          Enter
        </button>
      </form>

      <style>{`
        @keyframes gw-shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          60%       { transform: translateX(8px); }
          80%       { transform: translateX(-4px); }
        }
      `}</style>
    </div>
  );
}
