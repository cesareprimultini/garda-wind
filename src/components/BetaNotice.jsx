const REPO_URL = 'https://github.com/cesareprimultini/garda-wind';

export default function BetaNotice({ open, onDismiss }) {
  if (!open) return null;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '28px 24px 24px',
          maxWidth: 340,
          width: '100%',
          color: 'var(--text)',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          ⚠️ Heads up
        </div>

        <p style={{ margin: '0 0 10px', color: 'var(--text-2)' }}>
          This is a <strong style={{ color: 'var(--text-1)' }}>very beta</strong> side project built by one person who likes kite-surfing and hates checking 5 weather tabs. Expect rough edges. No warranty expressed or implied. Use at your own risk of getting wet.
        </p>

        <p style={{ margin: '0 0 16px', color: 'var(--text-2)' }}>
          Bugs? Ideas? Strong opinions?{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            Open an issue on GitHub
          </a>{' '}
          or drop me a line at{' '}
          <a href="mailto:primultini.cesare@gmail.com"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            primultini.cesare@gmail.com
          </a>.
        </p>

        <div style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--text-2)',
          marginBottom: 20,
        }}>
          <strong style={{ color: 'var(--text-1)' }}>📱 Pro tip:</strong> Add this to your homescreen — it works like a proper app. On iOS tap the share icon → "Add to Home Screen". On Android tap the browser menu → "Install app".
        </div>

        <button
          onClick={onDismiss}
          style={{
            width: '100%',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            padding: '10px 0',
            cursor: 'pointer',
            marginBottom: 14,
          }}
        >
          Got it, let's check the wind
        </button>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
          coded with Claude (Anthropic)
        </p>

        <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Weather: Open-Meteo.com (CC BY 4.0)<br />
          Meteograms: Meteotrentino · ΔP: profiwetter.ch
        </p>
      </div>
    </div>
  );
}
