import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gw_beta_notice_v1';
const REPO_URL = 'https://github.com/cesareprimultini/garda-wind';

const Row = ({ icon, color, bg, children }) => (
  <div style={{
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    background: bg,
    border: `1px solid ${color}22`,
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--text-2)',
    lineHeight: 1.55,
  }}>
    <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
    <span>{children}</span>
  </div>
);

export default function BetaNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  return (
    <>
      {/* Info button — always visible */}
      <button
        onClick={() => setOpen(true)}
        title="About this app"
        style={{
          position: 'fixed',
          bottom: 72,
          right: 12,
          zIndex: 900,
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(6,12,21,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--text-2)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          backdropFilter: 'blur(8px)',
        }}
      >
        i
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={dismiss}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0c1827',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 18,
              maxWidth: 340,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header band */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(80,144,255,0.18) 0%, rgba(13,207,168,0.12) 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              padding: '20px 20px 16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 4 }}>
                GardaWind
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>
                ⚠️ Very beta, much wind
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>

              <Row icon="🤙" color="#5090ff" bg="rgba(80,144,255,0.06)">
                Side project by one person who likes kite-surfing and hates checking 5 weather apps. Rough edges guaranteed. Use at your own risk of getting wet.
              </Row>

              <Row icon="🤖" color="#0dcfa8" bg="rgba(13,207,168,0.06)">
                Built with <strong style={{ color: 'var(--text-1)' }}>Claude</strong> (Anthropic's AI). Basically pair-programmed with a robot — judge accordingly.
              </Row>

              <Row icon="📱" color="#f5a428" bg="rgba(245,164,40,0.06)">
                <strong style={{ color: 'var(--text-1)' }}>Add to homescreen</strong> for a real app feel. iOS: share → "Add to Home Screen". Android: browser menu → "Install app".
              </Row>

              <Row icon="💬" color="#8da5be" bg="rgba(141,165,190,0.06)">
                Bugs or ideas?{' '}
                <a href={REPO_URL} target="_blank" rel="noreferrer"
                  style={{ color: '#7ab4ff', textDecoration: 'none', fontWeight: 600 }}>
                  GitHub
                </a>
                {' '}or{' '}
                <a href="mailto:primultini.cesare@gmail.com"
                  style={{ color: '#7ab4ff', textDecoration: 'none' }}>
                  primultini.cesare@gmail.com
                </a>
              </Row>

              {/* Dismiss */}
              <button
                onClick={dismiss}
                style={{
                  marginTop: 4,
                  width: '100%',
                  background: 'linear-gradient(135deg, #5090ff, #0dcfa8)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '11px 0',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                }}
              >
                Got it, let's check the wind
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
