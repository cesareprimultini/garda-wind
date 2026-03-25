/**
 * Compact stat card — label + value + unit
 * Props: { label, value, unit, subLabel, color }
 */
export default function StatCard({ label, value, unit, subLabel, color }) {
  return (
    <div className="card fade-up" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
      <div className="label-xs" style={{ marginBottom: 6 }}>{label}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flex: 1 }}>
        <span
          className="font-num"
          style={{
            fontSize: 'clamp(17px, 4vw, 24px)',
            fontWeight: 700,
            color: color || 'var(--text-1)',
            lineHeight: 1,
          }}
        >
          {value !== null && value !== undefined ? value : '—'}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </div>

      {subLabel && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}
