import { STATIONS, MODELS } from '../../utils/constants.js';
import RefreshIndicator from '../shared/RefreshIndicator.jsx';

/**
 * Minimal app header: logo + station selector + refresh
 * Props: { stationId, onStationChange, modelId, onModelChange, lastUpdated, isRefreshing, onRefresh }
 */
export default function Header({
  stationId,
  onStationChange,
  modelId,
  onModelChange,
  lastUpdated,
  isRefreshing,
  onRefresh,
}) {
  return (
    <header
      style={{
        flexShrink: 0,
        background: 'var(--surface)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--glass-border)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        zIndex: 50,
      }}
    >
      {/* Logo row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px 6px',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-1)',
            }}
          >
            GardaWind
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 400,
              color: 'var(--text-3)',
              letterSpacing: '0.04em',
            }}
          >
            Alto Garda
          </span>
        </div>

        {/* Right: model selector + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={modelId}
            onChange={e => onModelChange(e.target.value)}
            style={{
              background: 'rgba(80,144,255,0.09)',
              color: 'rgba(120,170,255,0.9)',
              border: '1px solid rgba(80,144,255,0.2)',
              borderRadius: 8,
              fontSize: 10,
              padding: '3px 8px',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
            aria-label="Forecast model"
          >
            {MODELS.map(m => (
              <option
                key={m.id}
                value={m.id}
                style={{ background: '#0f1a2e', color: 'var(--text-1)' }}
              >
                {m.label}
              </option>
            ))}
          </select>

          <RefreshIndicator
            lastUpdated={lastUpdated}
            isRefreshing={isRefreshing}
            onClick={onRefresh}
          />
        </div>
      </div>

      {/* Station selector */}
      <div className="scroll-x" style={{ padding: '0 14px 9px' }}>
        {STATIONS.map(s => {
          const active = s.id === stationId;
          return (
            <button
              key={s.id}
              onClick={() => onStationChange(s.id)}
              className={`pill ${active ? 'pill-active' : ''}`}
              style={{ fontSize: 12, padding: '3px 12px' }}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </header>
  );
}
