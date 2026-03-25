/**
 * Glass bottom navigation bar — text labels, no icons
 * Props: { activePanel, onPanelChange }
 */
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
        flexShrink: 0,
        display: 'flex',
        background: 'var(--surface)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid var(--glass-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
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
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
              padding: '10px 4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {/* Active indicator — pill behind label */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px 16px',
                borderRadius: 10,
                background: active ? 'rgba(255,255,255,0.075)' : 'transparent',
                transition: 'background 0.2s ease',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  letterSpacing: active ? '0.01em' : '0.02em',
                  color: active ? 'var(--text-1)' : 'var(--text-3)',
                  transition: 'color 0.2s ease, font-weight 0.2s ease',
                }}
              >
                {tab.label}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
