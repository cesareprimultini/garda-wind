import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import { formatTime, getRomeHour, getDayName } from '../../utils/formatters.js';

// ── Error threshold colours ──────────────────────────────────────
const errColor = (absErr) => {
  if (absErr <= 3) return '#0dcfa8';   // teal — good
  if (absErr <= 6) return '#f5a428';   // amber — moderate
  return '#ff4d6d';                    // red — poor
};

// ── Reliability label derived from MAE ──────────────────────────
function reliabilityLabel(mae, n) {
  if (n < 3) return { text: 'not enough data', color: '#4a6080' };
  if (mae <= 2.5) return { text: 'excellent', color: '#0dcfa8' };
  if (mae <= 4)   return { text: 'good',      color: '#56d67a' };
  if (mae <= 6)   return { text: 'fair',      color: '#f5a428' };
  return            { text: 'poor',           color: '#ff4d6d' };
}

// ── Per-hourly bucket aggregation ────────────────────────────────
// Average all observed readings within ±30 min of each hourly entry.
function buildPairs(hourlyPast, liveHistory) {
  const WINDOW = 30 * 60 * 1000; // 30 min in ms
  return hourlyPast.map(entry => {
    const entryMs = new Date(entry.time).getTime();
    const inWindow = liveHistory.filter(r =>
      r?.windSpeedKn != null && r.time &&
      Math.abs(new Date(r.time).getTime() - entryMs) <= WINDOW
    );
    if (!inWindow.length) return null;
    const avgObs = inWindow.reduce((s, r) => s + r.windSpeedKn, 0) / inWindow.length;
    const err = entry.windSpeed - avgObs;
    return {
      time: entry.time,
      diffH: entry.diffH,
      modelSpeed: entry.windSpeed,
      dpSpeed: entry.estimatedWindFromDp ?? null,
      obsSpeed: avgObs,
      error: err,
      n: inWindow.length,
    };
  }).filter(Boolean);
}

// ── Custom X-tick (time label only — no day name needed for ±12h) ─
function XTick({ x, y, payload, tickMeta }) {
  const meta = tickMeta?.get(payload?.value);
  if (!meta) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      {meta.showDay && (
        <text x={0} y={0} dy={11} textAnchor="middle"
          fill="#5a7a99" fontSize={9} fontWeight={600} letterSpacing="0.04em">
          {meta.dayLabel}
        </text>
      )}
      <text x={0} y={0} dy={meta.showDay ? 22 : 13} textAnchor="middle"
        fill="#324158" fontSize={10}>
        {meta.time}
      </text>
    </g>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const hasObs = d.obsSpeed != null;
  const err = hasObs ? d.error : null;
  return (
    <div style={{
      background: 'rgba(10,18,30,0.93)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `2px solid ${hasObs ? errColor(Math.abs(err)) : '#4d8fff'}`,
      borderRadius: 6,
      padding: '5px 9px',
      pointerEvents: 'none',
      minWidth: 130,
    }}>
      <div style={{ fontSize: 9, color: '#4a6080', marginBottom: 4, letterSpacing: '0.03em' }}>
        {formatTime(d.time)}
      </div>
      <div style={{ fontSize: 10, color: '#4d8fff', marginBottom: 2 }}>
        Model: <span className="font-num" style={{ fontWeight: 700 }}>
          {d.windSpeed != null ? Math.round(d.windSpeed) : '—'} kn
        </span>
      </div>
      {d.dpSpeed != null && (
        <div style={{ fontSize: 10, color: '#a05dfc', marginBottom: 2 }}>
          ΔP est.: <span className="font-num" style={{ fontWeight: 700 }}>
            {Math.round(d.dpSpeed)} kn
          </span>
        </div>
      )}
      {hasObs && (
        <>
          <div style={{ fontSize: 10, color: errColor(Math.abs(err)), marginBottom: 2 }}>
            Observed: <span className="font-num" style={{ fontWeight: 700 }}>
              {Math.round(d.obsSpeed)} kn
            </span>
          </div>
          <div style={{ fontSize: 9, color: '#4a6080' }}>
            Error: {err > 0 ? '+' : ''}{err.toFixed(1)} kn
          </div>
        </>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────
export default function ModelAccuracyChart({ data = [], liveHistory = [] }) {
  // Slice to past 12h + next 6h for the chart window
  const chartRange = useMemo(
    () => data.filter(d => d.diffH >= -12 && d.diffH <= 6),
    [data]
  );

  const pastEntries = useMemo(
    () => chartRange.filter(d => d.diffH <= 0),
    [chartRange]
  );

  // Build model↔observed pairs
  const pairs = useMemo(
    () => buildPairs(pastEntries, liveHistory),
    [pastEntries, liveHistory]
  );

  // Stats
  const stats = useMemo(() => {
    if (!pairs.length) return null;
    const n    = pairs.length;
    const bias = pairs.reduce((s, p) => s + p.error, 0) / n;
    const mae  = pairs.reduce((s, p) => s + Math.abs(p.error), 0) / n;
    return { bias, mae, n };
  }, [pairs]);

  const reliability = reliabilityLabel(stats?.mae ?? Infinity, stats?.n ?? 0);

  // Merge observed + dp into chart data (keyed by hourly time)
  const pairMap = useMemo(
    () => new Map(pairs.map(p => [p.time, p])),
    [pairs]
  );

  const chartData = useMemo(() =>
    chartRange.map(d => {
      const pair = pairMap.get(d.time);
      return {
        ...d,
        obsSpeed:  pair?.obsSpeed  ?? null,
        error:     pair?.error     ?? null,
        obsColor:  pair != null ? errColor(Math.abs(pair.error)) : null,
      };
    }),
    [chartRange, pairMap]
  );

  const nowEntry = data.find(d => d.isNow);
  const hasLive  = pairs.length > 0;

  // Ticks: every 3 entries, day label at noon-closest tick
  const tickEntries = chartRange.filter((_, i) => i % 3 === 0);
  const dayToNoon = new Map();
  tickEntries.forEach(e => {
    const day  = e.time.substring(0, 10);
    const dist = Math.abs(getRomeHour(e.time) - 12);
    if (!dayToNoon.has(day) || dist < Math.abs(getRomeHour(dayToNoon.get(day).time) - 12)) {
      dayToNoon.set(day, e);
    }
  });
  const noonSet = new Set([...dayToNoon.values()].map(e => e.time));

  const tickMeta = new Map();
  tickEntries.forEach(e => {
    const showDay = noonSet.has(e.time);
    tickMeta.set(e.time, {
      time:     formatTime(e.time),
      showDay,
      dayLabel: showDay ? getDayName(e.time) : null,
    });
  });
  const ticks = tickEntries.map(e => e.time);

  if (!chartRange.length) return null;

  return (
    <div className="card p-4">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div className="section-label">Model vs Observed · Last 12h</div>
          {hasLive && (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>
              {stats.n} hourly comparison{stats.n !== 1 ? 's' : ''} — model wind vs live station average
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {hasLive ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: reliability.color, letterSpacing: '0.03em' }}>
                {reliability.text.toUpperCase()}
              </div>
              <div style={{ fontSize: 9, color: '#4a6080', marginTop: 1 }}>
                bias {stats.bias > 0 ? '+' : ''}{stats.bias.toFixed(1)} · MAE {stats.mae.toFixed(1)} kn
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#4a6080' }}>no observed data</div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          {/* Shade the history zone (past) */}
          {nowEntry && chartData[0] && (
            <ReferenceArea
              x1={chartData[0].time}
              x2={nowEntry.time}
              fill="rgba(255,255,255,0.025)"
              label={{
                value: '← history',
                position: 'insideTopLeft',
                fill: 'rgba(255,255,255,0.12)',
                fontSize: 9,
              }}
            />
          )}

          <XAxis
            dataKey="time"
            ticks={ticks}
            height={36}
            tick={<XTick tickMeta={tickMeta} />}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 'auto']}
            unit=" kn"
          />
          <Tooltip content={<CustomTooltip />} />

          {/* "now" reference line */}
          {nowEntry && (
            <ReferenceLine
              x={nowEntry.time}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: 'now', fill: 'rgba(255,255,255,0.35)', fontSize: 8, position: 'insideTopRight' }}
            />
          )}

          <defs>
            <linearGradient id="accModelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4d8fff" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#4d8fff" stopOpacity={0.0}  />
            </linearGradient>
          </defs>

          {/* Model forecast (area) */}
          <Area
            type="monotone" dataKey="windSpeed"
            stroke="#4d8fff" strokeWidth={2}
            fill="url(#accModelGrad)" dot={false}
            isAnimationActive={false} connectNulls
          />

          {/* ΔP-estimated wind (physics predictor) */}
          <Line
            type="monotone" dataKey="estimatedWindFromDp"
            stroke="#a05dfc" strokeWidth={1.5}
            strokeDasharray="5 4" dot={false}
            isAnimationActive={false} connectNulls
          />

          {/* Observed dots — colored by |error| */}
          {hasLive && (
            <Line
              type="monotone"
              dataKey="obsSpeed"
              stroke="transparent"
              strokeWidth={0}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.obsSpeed == null) return null;
                const col = payload.obsColor ?? '#0dcfa8';
                return (
                  <g key={`obs-${payload.time}`}>
                    {/* Error bar: vertical line from dot to model value */}
                    {payload.windSpeed != null && (
                      <line
                        x1={cx} y1={cy}
                        x2={cx}
                        y2={cy - (payload.error ?? 0) * 4}  // approx — visual only
                        stroke={col} strokeWidth={1.5} strokeOpacity={0.4}
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={cx} cy={cy} r={5}
                      fill={col} stroke="#0a1e2a" strokeWidth={1.5}
                    />
                  </g>
                );
              }}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div
        className="flex gap-4 mt-2 text-xs"
        style={{ color: '#324158', flexWrap: 'wrap', rowGap: 4 }}
      >
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#4d8fff', borderRadius: 1 }} />
          Model (AROME)
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: '2px dashed #a05dfc' }} />
          ΔP estimate
        </span>
        {hasLive && (
          <>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#0dcfa8', border: '1px solid #0a1e2a' }} />
              Observed (err ≤3 kn)
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#f5a428', border: '1px solid #0a1e2a' }} />
              3–6 kn
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ff4d6d', border: '1px solid #0a1e2a' }} />
              &gt;6 kn
            </span>
          </>
        )}
      </div>

      {!hasLive && (
        <div style={{ fontSize: 10, color: '#4a6080', marginTop: 8, textAlign: 'center' }}>
          Live history available for Torbole &amp; Riva del Garda (5-min Meteotrentino data).
          Select one of those stations to see model accuracy.
        </div>
      )}
    </div>
  );
}
