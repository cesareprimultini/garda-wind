import { useRef, useEffect } from 'react';
import { QUALITY_COLORS, QUALITY_LABELS, REGIME_COLORS } from '../../utils/constants.js';
import { degreesToCompass } from '../../utils/windPhysics.js';

// ── Wind direction arrow (points toward where wind is travelling) ─────────────
function WindArrow({ dir, size = 11, color = '#4a6a80' }) {
  if (dir == null) return <span style={{ display: 'inline-block', width: size, height: size }} />;
  // Arrow points in travel direction: wind comes FROM dir, goes TO dir+180
  const rotation = (dir + 180) % 360;
  return (
    <svg
      width={size} height={size} viewBox="0 0 12 12"
      style={{ transform: `rotate(${rotation}deg)`, display: 'block', flexShrink: 0 }}
      aria-label={`${degreesToCompass(dir)} wind`}
    >
      {/* Slim upward-pointing arrow */}
      <polygon points="6,1 9,8.5 6,7 3,8.5" fill={color} />
      <line x1="6" y1="7" x2="6" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Quality colour → fine-grained background tint ────────────────────────────
// Returns an rgba string with low opacity for use as cell background
function qualityBg(quality, isPast) {
  const alpha = isPast ? 0.06 : 0.13;
  const map = {
    none:     `rgba(50,65,88,${alpha})`,
    marginal: `rgba(56,189,248,${alpha})`,
    good:     `rgba(13,207,168,${alpha})`,
    advanced: `rgba(245,164,40,${alpha})`,
    storm:    `rgba(244,63,94,${alpha})`,
  };
  return map[quality] ?? map.none;
}

// ── Top colour bar per cell ───────────────────────────────────────────────────
function qualityBar(quality, isPast) {
  const c = QUALITY_COLORS[quality] ?? QUALITY_COLORS.none;
  return isPast ? `${c}66` : c;
}

// ── Detect first hour of a new day to insert day-chip dividers ────────────────
function getRomeDate(isoString) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(isoString));
  } catch { return ''; }
}

function getRomeHourNum(isoString) {
  try {
    return parseInt(
      new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Rome' })
        .format(new Date(isoString)), 10,
    );
  } catch { return 0; }
}

/**
 * Compact horizontally-scrollable wind forecast strip.
 *
 * Each hour column shows (top to bottom):
 *   ▬  5px quality colour bar  (heatmap element — immediately scannable)
 *   14  time label (every 3h only to avoid clutter)
 *   18  wind speed kn (large, quality-coloured)
 *   ↑  wind direction arrow
 *   14° temperature
 *
 * Day-chip dividers are injected between days.
 * "Now" column has a white outline highlight and auto-scrolls into view.
 *
 * Props: { data: hourly[], hours?: number }
 */
export default function WindHeatmap({ data = [], hours = 168 }) {
  const scrollRef = useRef(null);
  const nowRef    = useRef(null);

  // Scroll to now on mount / data change
  useEffect(() => {
    if (nowRef.current && scrollRef.current) {
      const el = nowRef.current;
      const c  = scrollRef.current;
      c.scrollTo({
        left: Math.max(0, el.offsetLeft - 60), // leave a little context before
        behavior: 'smooth',
      });
    }
  }, [data.length]);

  // Filter: show from 1h before now to end of requested window
  const filtered = data.filter(d => d.diffH >= -1 && d.diffH <= hours);

  // Resolve "now" for past-hour dimming
  const nowDateKey = getRomeDate(new Date().toISOString());
  const nowHourNum = getRomeHourNum(new Date().toISOString());

  if (filtered.length === 0) {
    return (
      <div className="card" style={{ padding: 14, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
        No forecast data
      </div>
    );
  }

  // Build flat list of items: { type: 'day', label, dateLabel } | { type: 'hour', entry }
  const items = [];
  let lastDate = null;

  for (const entry of filtered) {
    const dateKey = getRomeDate(entry.time);
    if (dateKey !== lastDate) {
      const d = new Date(entry.time);
      const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Rome' }).format(d);
      const dateLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }).format(d);
      const isToday = dateKey === nowDateKey;
      items.push({ type: 'day', dayName: isToday ? 'Today' : dayName, dateLabel, isToday, dateKey });
      lastDate = dateKey;
    }
    items.push({ type: 'hour', entry });
  }

  return (
    <div className="card" style={{ padding: '10px 0 8px', overflow: 'hidden' }}>
      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="scroll-x"
        style={{ padding: '0 10px', alignItems: 'stretch', gap: 0 }}
        role="region"
        aria-label="Hourly wind session forecast"
      >
        {items.map((item, idx) => {
          // ── Day chip ──────────────────────────────────────────────────────
          if (item.type === 'day') {
            return (
              <div
                key={`day-${item.dateKey}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  flexShrink: 0,
                  width: 26,
                  paddingBottom: 4,
                  paddingRight: 4,
                  borderRight: idx > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  marginRight: 2,
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: item.isToday ? 700 : 600,
                  color: item.isToday ? 'var(--text-1)' : 'var(--text-2)',
                  writingMode: 'vertical-rl', textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  lineHeight: 1.1,
                }}>
                  {item.dayName}
                </span>
                <span style={{
                  fontSize: 8, color: 'var(--text-3)',
                  writingMode: 'vertical-rl', textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  marginTop: 2,
                }}>
                  {item.dateLabel}
                </span>
              </div>
            );
          }

          // ── Hour cell ─────────────────────────────────────────────────────
          const { entry } = item;
          const isNow    = entry.isNow;
          const hNum     = getRomeHourNum(entry.time);
          const dateKey  = getRomeDate(entry.time);
          const isPast   = dateKey < nowDateKey || (dateKey === nowDateKey && hNum < nowHourNum);

          const quality  = entry.quality ?? 'none';
          const qColor   = QUALITY_COLORS[quality] ?? QUALITY_COLORS.none;
          const rColor   = REGIME_COLORS[entry.regime] ?? REGIME_COLORS.variable;
          const hasWind  = (entry.windSpeed ?? 0) >= 8;

          // Ensemble uncertainty: low agreement = uncertain forecast
          const ensAgree  = entry.dpAgreementFraction ?? null;
          const uncertain = ensAgree !== null && ensAgree < 0.65;

          // Show time label only every 3 hours, or always on "now"
          const showTime = isNow || hNum % 3 === 0;

          // Wind direction: arrow colour matches quality when there's wind
          const arrowColor = hasWind ? `${qColor}cc` : '#2a3a4a';

          return (
            <div
              key={entry.time}
              ref={isNow ? nowRef : null}
              title={`${hNum}:00 · ${entry.windSpeed != null ? Math.round(entry.windSpeed) + ' kn' : '—'} · ${degreesToCompass(entry.windDir ?? 0)} · ${entry.temp != null ? Math.round(entry.temp) + '°C' : ''} · ${QUALITY_LABELS[quality] ?? quality}${uncertain ? ' · uncertain forecast' : ''}`}
              style={{
                flexShrink: 0,
                width: 44,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
                borderRadius: 7,
                overflow: 'hidden',
                background: qualityBg(quality, isPast),
                border: isNow
                  ? '1.5px solid rgba(255,255,255,0.55)'
                  : uncertain
                  ? '1.5px dashed rgba(255,255,255,0.18)'
                  : '1.5px solid rgba(255,255,255,0.04)',
                opacity: isPast ? 0.55 : 1,
                marginRight: 2,
              }}
            >
              {/* Quality colour bar — the heatmap element */}
              <div style={{
                width: '100%', height: 5, flexShrink: 0,
                background: qualityBar(quality, isPast),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {uncertain && (
                  <span style={{ fontSize: 5, color: 'rgba(255,255,255,0.7)', lineHeight: 1, userSelect: 'none' }}>~</span>
                )}
              </div>

              {/* Content area */}
              <div style={{
                flex: 1, width: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 2px 5px',
                gap: 2,
              }}>
                {/* Time */}
                <span
                  className="font-num"
                  style={{
                    fontSize: 9,
                    color: isNow ? '#7ab4ff' : 'var(--text-3)',
                    fontWeight: isNow ? 700 : 400,
                    visibility: showTime ? 'visible' : 'hidden',
                    lineHeight: 1,
                  }}
                >
                  {hNum.toString().padStart(2, '0')}
                </span>

                {/* Wind speed */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <span
                    className="font-num"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: hasWind ? qColor : 'var(--text-3)',
                      lineHeight: 1,
                    }}
                  >
                    {entry.windSpeed != null ? Math.round(entry.windSpeed) : '—'}
                  </span>
                  <span style={{ fontSize: 7, color: 'var(--text-3)', alignSelf: 'flex-end', marginBottom: 1 }}>kn</span>
                </div>

                {/* Wind direction arrow */}
                <WindArrow dir={entry.windDir} size={11} color={arrowColor} />

                {/* Regime dot */}
                <span style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: hasWind ? rColor : 'var(--text-3)',
                  flexShrink: 0,
                }} />

                {/* Temperature */}
                <span
                  className="font-num"
                  style={{ fontSize: 8, color: 'var(--text-3)', lineHeight: 1 }}
                >
                  {entry.temp != null ? `${Math.round(entry.temp)}°` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend row — compact, inline */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px 0',
        flexWrap: 'wrap',
      }}>
        {[['marginal','Marginal'],['good','Session On'],['advanced','Advanced'],['storm','Too Strong']].map(([q, label]) => (
          <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: QUALITY_COLORS[q], flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: 'var(--text-3)' }}>{label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>- -</span>
          <span style={{ fontSize: 8, color: 'var(--text-3)' }}>uncertain</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
          <span style={{ fontSize: 8, color: 'var(--text-3)', fontStyle: 'italic' }}>
            AROME 1.3km · ΔP regime
          </span>
        </div>
      </div>
    </div>
  );
}
