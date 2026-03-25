import { QUALITY_COLORS } from '../../utils/constants.js';
import { getWindsurfSail } from '../../utils/windPhysics.js';

/**
 * Kite & windsurf size recommendation — no icons, no borders
 * Props: { windSpeed, kiteSizeLabel, quality }
 */
export default function KiteSizeCard({ windSpeed, kiteSizeLabel, quality }) {
  const qualityColor = QUALITY_COLORS[quality] ?? QUALITY_COLORS.none;
  const sailSize     = getWindsurfSail(windSpeed);
  const hasWind      = quality !== 'none';

  return (
    <div className="card fade-up" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="label-xs" style={{ marginBottom: 10 }}>Gear</div>

      {/* Kite */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>Kite</div>
        <div
          className="font-num"
          style={{
            fontSize: 'clamp(15px, 3.5vw, 20px)',
            fontWeight: 700,
            color: hasWind ? qualityColor : 'var(--text-3)',
            lineHeight: 1.1,
          }}
        >
          {hasWind ? kiteSizeLabel : '—'}
        </div>
      </div>

      {/* Windsurf */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>Sail</div>
        <div
          className="font-num"
          style={{
            fontSize: 'clamp(13px, 3vw, 17px)',
            fontWeight: 600,
            color: hasWind ? `${qualityColor}cc` : 'var(--text-3)',
            lineHeight: 1.1,
          }}
        >
          {hasWind ? sailSize : '—'}
        </div>
      </div>
    </div>
  );
}
