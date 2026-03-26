import { QUALITY_COLORS, QUALITY_LABELS } from '../../utils/constants.js';
import { getDayName } from '../../utils/formatters.js';

// Hours shown across the top (columns)
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

/**
 * Group hourly entries by date (Europe/Rome) and hour.
 * Returns Map<dateKey, Map<hour, entry>>
 */
function groupByDayHour(hourly) {
  const days = new Map();
  for (const entry of hourly) {
    if (entry.diffH < 0 || entry.diffH > 168) continue;
    try {
      const local = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(entry.time));
      const h = parseInt(
        new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Rome' })
          .format(new Date(entry.time)),
        10,
      );
      if (!days.has(local)) days.set(local, new Map());
      days.get(local).set(h, entry);
    } catch { /* skip */ }
  }
  return days;
}

/**
 * Pick a text colour (black or white) that contrasts against bg.
 * bg is one of the QUALITY_COLORS hex values.
 */
function contrastText(hex) {
  // Very dark bg → use dim text; bright bg → use dark text
  if (!hex || hex === '#324158') return '#4a6a80'; // none — subtle
  return 'rgba(0,0,0,0.7)';
}

/**
 * Wind heatmap — 2D grid: rows = days, cols = hours of day (06–22).
 * Each cell is coloured by QUALITY_COLORS. Shows model wind speed per cell.
 *
 * Props: { data: hourly[], days?: number }
 */
export default function WindHeatmap({ data = [], days = 7 }) {
  const grouped = groupByDayHour(data);

  // Slice to requested day count; skip days entirely in the past
  const dayEntries = Array.from(grouped.entries()).slice(0, days);

  if (dayEntries.length === 0) {
    return (
      <div className="card" style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
        No forecast data
      </div>
    );
  }

  // Identify "now" hour for current-hour highlight
  const nowDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const nowHour = parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Rome' }).format(new Date()),
    10,
  );

  const cellW = 32;  // px per hour column
  const rowH  = 36;  // px per day row
  const labelW = 40; // px for day label column

  return (
    <div className="card" style={{ padding: '12px 10px', overflowX: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
        Wind Session Windows
      </div>

      {/* Scroll wrapper */}
      <div style={{ minWidth: labelW + HOURS.length * cellW }}>

        {/* Hour header row */}
        <div style={{ display: 'flex', marginBottom: 4, marginLeft: labelW }}>
          {HOURS.map(h => (
            <div
              key={h}
              style={{
                width: cellW,
                flexShrink: 0,
                textAlign: 'center',
                fontSize: 9,
                color: h === nowHour ? '#7ab4ff' : 'var(--text-3)',
                fontWeight: h === nowHour ? 700 : 400,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {dayEntries.map(([dateKey, hourMap]) => {
          const firstEntry = hourMap.values().next().value;
          const dayLabel   = firstEntry ? getDayName(firstEntry.time) : dateKey.slice(5);
          const dateLabel  = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
            .format(new Date(dateKey));
          const isToday = dateKey === nowDate;

          return (
            <div key={dateKey} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
              {/* Day label */}
              <div style={{ width: labelW, flexShrink: 0, paddingRight: 6 }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--text-1)' : 'var(--text-2)', lineHeight: 1.1 }}>
                  {dayLabel}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{dateLabel}</div>
              </div>

              {/* Hour cells */}
              {HOURS.map(h => {
                const entry = hourMap.get(h);
                const quality = entry?.quality ?? 'none';
                const speed   = entry?.windSpeed ?? null;
                const bg      = QUALITY_COLORS[quality] ?? QUALITY_COLORS.none;
                const isPast  = isToday && h < nowHour;
                const isNow   = isToday && h === nowHour;

                return (
                  <div
                    key={h}
                    title={entry ? `${h}:00 · ${speed !== null ? Math.round(speed) + ' kn' : '—'} · ${QUALITY_LABELS[quality] ?? quality}` : `${h}:00 · no data`}
                    style={{
                      width: cellW,
                      height: rowH,
                      flexShrink: 0,
                      marginRight: 1,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isPast ? `${bg}55` : bg,
                      opacity: quality === 'none' ? (isPast ? 0.25 : 0.55) : (isPast ? 0.5 : 1),
                      outline: isNow ? '2px solid rgba(255,255,255,0.7)' : 'none',
                      outlineOffset: -2,
                      transition: 'background 0.15s',
                    }}
                  >
                    {speed !== null && quality !== 'none' && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: contrastText(bg),
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                      }}>
                        {Math.round(speed)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(QUALITY_COLORS).filter(([q]) => q !== 'none').map(([q, color]) => (
            <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{QUALITY_LABELS[q] ?? q}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-3)', fontStyle: 'italic' }}>numbers = kn (model)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
