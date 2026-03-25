import { useRef, useEffect } from 'react';
import { QUALITY_COLORS, REGIME_COLORS } from '../../utils/constants.js';
import { formatTime } from '../../utils/formatters.js';
import { degreesToCompass } from '../../utils/windPhysics.js';

/**
 * Horizontal scrollable hourly strip — next 36h, daytime hours only
 * Props: { data: array }
 */
export default function HourlyTimeline({ data = [] }) {
  const scrollRef = useRef(null);
  const nowRef    = useRef(null);

  // Filter: next 36h, hours 6–22 in Europe/Rome
  const filtered = data.filter(d => {
    if (d.diffH < -1 || d.diffH > 36) return false;
    try {
      const h = parseInt(
        new Intl.DateTimeFormat('en-GB', {
          hour: 'numeric', hour12: false, timeZone: 'Europe/Rome',
        }).format(new Date(d.time)),
        10,
      );
      return h >= 6 && h <= 22;
    } catch { return true; }
  });

  // Scroll to "now" on mount
  useEffect(() => {
    if (nowRef.current && scrollRef.current) {
      const el = nowRef.current;
      const c  = scrollRef.current;
      c.scrollTo({ left: Math.max(0, el.offsetLeft - c.offsetWidth / 2 + el.offsetWidth / 2), behavior: 'smooth' });
    }
  }, [data.length]);

  return (
    <div
      ref={scrollRef}
      className="scroll-x"
      style={{ padding: '2px 0', alignItems: 'stretch' }}
      role="region"
      aria-label="Hourly wind forecast"
    >
      {filtered.map(entry => {
        const isNow   = entry.isNow;
        const qColor  = QUALITY_COLORS[entry.quality] ?? QUALITY_COLORS.none;
        const rColor  = REGIME_COLORS[entry.regime]   ?? REGIME_COLORS.variable;
        const hasWind = (entry.windSpeed ?? 0) > 8;

        return (
          <div
            key={entry.time}
            ref={isNow ? nowRef : null}
            title={`${formatTime(entry.time)} · ${Math.round(entry.windSpeed ?? 0)} kn · ${degreesToCompass(entry.windDir ?? 0)} · ${entry.regime}`}
            style={{
              minWidth: 44,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '7px 5px',
              borderRadius: 10,
              background: isNow ? 'rgba(80,144,255,0.1)' : 'rgba(255,255,255,0.025)',
              border: `1px solid ${isNow ? 'rgba(80,144,255,0.35)' : 'rgba(255,255,255,0.04)'}`,
            }}
          >
            {/* Hour */}
            <span
              className="font-num"
              style={{ fontSize: 9, color: isNow ? '#7ab4ff' : 'var(--text-3)', fontWeight: isNow ? 600 : 400 }}
            >
              {formatTime(entry.time)}
            </span>

            {/* Speed */}
            <span
              className="font-num"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: hasWind ? qColor : 'var(--text-3)',
                lineHeight: 1,
              }}
            >
              {entry.windSpeed !== null ? Math.round(entry.windSpeed) : '—'}
            </span>

            <span style={{ fontSize: 8, color: 'var(--text-3)' }}>kn</span>

            {/* Regime dot */}
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: hasWind ? rColor : 'var(--text-3)',
                flexShrink: 0,
              }}
            />
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 12, alignSelf: 'center', padding: '0 8px' }}>
          No hourly data
        </div>
      )}
    </div>
  );
}
