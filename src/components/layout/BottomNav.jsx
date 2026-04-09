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
        left: 10,
        right: 10,
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderBottom: 'none',
        borderRadius: '24px 24px 0 0',
        paddingTop: 5,
        paddingLeft: 5,
        paddingRight: 5,
        paddingBottom: 'env(safe-area-inset-bottom, 5px)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.07) inset',
      }}
    >
      {/* Button row */}
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
                padding: '9px 4px',
                borderRadius: 19,
                background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                boxShadow: active ? '0 1px 0 rgba(255,255,255,0.07) inset' : 'none',
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
