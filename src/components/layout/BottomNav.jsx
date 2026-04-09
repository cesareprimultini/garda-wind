export default function BottomNav({ activePanel, onPanelChange }) {
  const tabs = [
    { id: 'dashboard', label: 'Now' },
    { id: 'forecast',  label: 'Forecast' },
    { id: 'map',       label: 'Map' },
  ];

  return (
    <nav
      aria-label="App navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        background: 'rgba(6,12,21,0.6)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.09)',
        paddingTop: 6,
        paddingLeft: 10,
        paddingRight: 10,
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div style={{ display: 'flex', gap: 2 }}>
        {tabs.map(tab => {
          const active = activePanel === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onPanelChange(tab.id)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
                borderRadius: 14,
                background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.01em',
                  color: active ? 'var(--text-1)' : 'var(--text-2)',
                  transition: 'color 0.2s ease, font-weight 0.2s ease',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
