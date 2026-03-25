import { QUALITY_COLORS, QUALITY_LABELS, REGIME_COLORS } from '../../utils/constants.js';
import { getDayName } from '../../utils/formatters.js';

function groupByDay(hourly) {
  const days = new Map();
  for (const entry of hourly) {
    try {
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(entry.time));
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(entry);
    } catch { /* skip */ }
  }
  return days;
}

function dominantRegime(entries) {
  const counts = {};
  for (const e of entries) counts[e.regime] = (counts[e.regime] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'variable';
}

function bestQuality(entries) {
  const order = ['storm', 'advanced', 'good', 'marginal', 'none'];
  const daytime = entries.filter(e => {
    try {
      const h = parseInt(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Rome' }).format(new Date(e.time)), 10);
      return h >= 8 && h <= 20;
    } catch { return true; }
  });
  for (const q of order) {
    if (daytime.some(e => e.quality === q)) return q;
  }
  return 'none';
}

/**
 * 7-day outlook — horizontal scrollable day cards, no accent borders
 * Props: { data: array }
 */
export default function DayOutlookGrid({ data = [] }) {
  const grouped    = groupByDay(data.filter(d => d.diffH >= 0));
  const dayEntries = Array.from(grouped.entries()).slice(0, 7).map(([dateKey, entries]) => ({
    dateKey,
    dayName: getDayName(entries[0]?.time),
    date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
      .format(new Date(entries[0]?.time ?? Date.now())),
    maxWind: Math.max(...entries.map(e => e.windSpeed ?? 0)),
    minDp: Math.min(...entries.filter(e => e.dp !== null).map(e => e.dp ?? 0)),
    maxDp: Math.max(...entries.filter(e => e.dp !== null).map(e => e.dp ?? 0)),
    regime:  dominantRegime(entries),
    quality: bestQuality(entries),
  }));

  if (dayEntries.length === 0) {
    return (
      <div className="card" style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
        No forecast data available
      </div>
    );
  }

  return (
    <div className="scroll-x" style={{ padding: '2px 0' }}>
      {dayEntries.map(day => {
        const qColor = QUALITY_COLORS[day.quality] ?? QUALITY_COLORS.none;
        const rColor = REGIME_COLORS[day.regime]   ?? REGIME_COLORS.variable;

        return (
          <div
            key={day.dateKey}
            className="card"
            style={{
              minWidth: 94,
              flexShrink: 0,
              padding: '12px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              // Subtle quality tint instead of accent border
              background: `rgba(${
                day.quality === 'good' ? '13,207,168' :
                day.quality === 'advanced' ? '245,164,40' :
                day.quality === 'storm' ? '244,63,94' :
                day.quality === 'marginal' ? '56,189,248' :
                '50,65,88'
              },0.06)`,
              borderColor: `rgba(${
                day.quality === 'good' ? '13,207,168' :
                day.quality === 'advanced' ? '245,164,40' :
                day.quality === 'storm' ? '244,63,94' :
                day.quality === 'marginal' ? '56,189,248' :
                '255,255,255'
              },${day.quality !== 'none' ? '0.1' : '0.065'})`,
            }}
          >
            {/* Day */}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
              {day.dayName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
              {day.date}
            </div>

            {/* Max wind */}
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 1 }}>Peak</div>
              <span className="font-num" style={{ fontSize: 20, fontWeight: 700, color: qColor, lineHeight: 1 }}>
                {day.maxWind > 0 ? Math.round(day.maxWind) : '—'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 2 }}>kn</span>
            </div>

            {/* Regime */}
            <div style={{ fontSize: 10, fontWeight: 600, color: rColor }}>
              {day.regime === 'pelér' ? 'Pelér' : day.regime === 'ora' ? 'Ora' : 'Variable'}
            </div>

            {/* ΔP range */}
            {isFinite(day.minDp) && isFinite(day.maxDp) && Math.abs(day.minDp) < 20 && (
              <div className="font-num" style={{ fontSize: 9, color: 'var(--text-3)' }}>
                ΔP {day.minDp.toFixed(1)}…{day.maxDp.toFixed(1)}
              </div>
            )}

            {/* Quality label */}
            <div style={{ fontSize: 10, color: qColor, fontWeight: 600, marginTop: 2 }}>
              {QUALITY_LABELS[day.quality] ?? ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
