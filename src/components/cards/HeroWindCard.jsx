import Compass from '../shared/Compass.jsx';
import { degreesToCompass } from '../../utils/windPhysics.js';
import { QUALITY_COLORS, QUALITY_LABELS, REGIME_COLORS } from '../../utils/constants.js';

/**
 * Current wind conditions for the selected station.
 * Compact — no wasted vertical space.
 * Props: { current, regime, quality, kiteSizeLabel }
 */
export default function HeroWindCard({ current, regime, quality }) {
  const speed = current?.windSpeed ?? null;
  const gusts = current?.windGusts ?? null;
  const dir   = current?.windDir   ?? 0;

  const qualityColor = QUALITY_COLORS[quality] ?? QUALITY_COLORS.none;
  const qualityLabel = QUALITY_LABELS[quality]  ?? 'No Wind';
  const regimeColor  = REGIME_COLORS[regime]    ?? REGIME_COLORS.variable;
  const compassDir   = degreesToCompass(dir);

  const hasWind = quality !== 'none';

  const cardClass = quality === 'good' || quality === 'advanced'
    ? 'card card-good glow-good fade-up'
    : quality === 'storm'
    ? 'card card-storm fade-up'
    : regime === 'pelér'
    ? 'card card-peler fade-up'
    : regime === 'ora'
    ? 'card card-ora fade-up'
    : 'card fade-up';

  // Regime label — only show when there's wind, or when ΔP is meaningful
  const regimeLabel = regime === 'pelér' ? 'Pelér' : regime === 'ora' ? 'Ora' : null;
  const regimeBadgeClass = `badge badge-${regime === 'pelér' ? 'peler' : regime === 'ora' ? 'ora' : 'variable'}`;

  return (
    <div className={cardClass} style={{ padding: '12px 14px' }}>

      {/* Top row: label + direction + compass */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div className="label-xs" style={{ marginBottom: 3 }}>Wind Now</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>
            {compassDir}
            <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
              {' '}· {String(Math.round(dir)).padStart(3, '0')}°
            </span>
          </div>
        </div>
        <Compass degrees={dir} size={44} color={regimeColor} />
      </div>

      {/* Speed */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, lineHeight: 1, marginBottom: 4 }}>
        <span
          className="font-num"
          style={{ fontSize: 'clamp(40px, 10vw, 58px)', fontWeight: 700, color: qualityColor, lineHeight: 1 }}
        >
          {speed !== null ? Math.round(speed) : '—'}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-2)', paddingBottom: 5 }}>kn</span>
        {gusts !== null && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', paddingBottom: 4, marginLeft: 4 }}>
            ↑<span className="font-num" style={{ color: 'var(--text-2)' }}>{Math.round(gusts)}</span>
          </span>
        )}
      </div>

      {/* Status row — regime + quality merged, no duplicate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {hasWind && regimeLabel && (
          <span className={regimeBadgeClass}>{regimeLabel}</span>
        )}
        <div
          style={{
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            background: `${qualityColor}16`,
            border: `1px solid ${qualityColor}28`,
            color: qualityColor,
          }}
        >
          {/* When no wind, skip regime — "No Wind" says it all */}
          {!hasWind && !regimeLabel ? 'No Wind'
            : !hasWind ? `${regime === 'pelér' ? 'Pelér' : regime === 'ora' ? 'Ora' : 'Variable'} · No Wind`
            : qualityLabel}
        </div>
      </div>
    </div>
  );
}
