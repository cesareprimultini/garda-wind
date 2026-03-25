import { useRef } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import { formatTime, formatDp, getDayName, getRomeHour } from '../../utils/formatters.js';
import { getDpInterpretation } from '../../utils/windPhysics.js';

// ── Smart two-line tick ──────────────────────────────────────────
function SmartXTick({ x, y, payload, tickMeta }) {
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

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const interp = getDpInterpretation(d.dp);
  const col = d.dp < -1.5 ? '#5090ff' : d.dp > 1.5 ? '#f5a428' : '#6a8099';
  return (
    <div style={{
      background: 'rgba(10,18,30,0.93)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `2px solid ${col}`,
      borderRadius: 6,
      padding: '5px 9px',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 9, color: '#4a6080', marginBottom: 3, letterSpacing: '0.03em' }}>
        {formatTime(d.time)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 3 }}>
        <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: col, lineHeight: 1 }}>
          {formatDp(d.dp)}
        </span>
      </div>
      <div style={{ fontSize: 9, color: '#5a7a8a', lineHeight: 1.4 }}>{interp.description}</div>
      {interp.estimatedKnots && (
        <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>
          <span className="font-num" style={{ color: col }}>~{interp.estimatedKnots} kn</span>
          {' est.'}
        </div>
      )}
    </div>
  );
};

/**
 * ΔP chart — clean zone-based design, no overlapping axis labels.
 *
 * Zone bands (ReferenceArea) replace inline ReferenceLine labels:
 *   below −1.5 hPa = Pelér zone (blue tint)
 *   above +1.5 hPa = Ora zone   (amber tint)
 *
 * Y-axis ticks are set to meaningful physics thresholds only.
 */
export default function DeltaPressureChart({ data = [], timeRange = '48h', onTimeRangeChange }) {
  const hasRendered = useRef(false);

  const hours    = timeRange === '24h' ? 24 : timeRange === '48h' ? 48 : 168;
  const filtered = data.filter(d => d.dp !== null && d.diffH >= -2 && d.diffH <= hours);
  const nowEntry = data.find(d => d.isNow);

  // ── Build tick metadata ────────────────────────────────────
  const tickCount   = timeRange === '24h' ? 6 : timeRange === '48h' ? 8 : 7;
  const step        = Math.max(1, Math.floor(filtered.length / tickCount));
  const tickEntries = filtered.filter((_, i) => i % step === 0);

  // For each calendar day find the tick closest to noon (12:00 Rome)
  const dayToNoon = new Map();
  tickEntries.forEach(entry => {
    const day  = entry.time.substring(0, 10);
    const dist = Math.abs(getRomeHour(entry.time) - 12);
    if (!dayToNoon.has(day) || dist < Math.abs(getRomeHour(dayToNoon.get(day).time) - 12)) {
      dayToNoon.set(day, entry);
    }
  });
  const noonSet = new Set([...dayToNoon.values()].map(e => e.time));

  const tickMeta = new Map();
  tickEntries.forEach(entry => {
    const showDay = noonSet.has(entry.time);
    tickMeta.set(entry.time, {
      time:     formatTime(entry.time),
      showDay,
      dayLabel: showDay ? getDayName(entry.time) : null,
    });
  });
  const ticks = tickEntries.map(e => e.time);

  const xAxisHeight  = 36;  // always — every view has at least today's label
  const bottomMargin = 4;

  // y-axis: only show meaningful threshold values
  const yTicks  = [-6, -3, 0, 3, 6];
  const yDomain = [-8, 8];

  const animate = !hasRendered.current;
  if (filtered.length > 0) hasRendered.current = true;

  return (
    <div className="card p-4">
      {/* Header — no time-range buttons here, controlled by ForecastPanel */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>
        ΔP Pressure Differential
        <span style={{ fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>hPa</span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={filtered} margin={{ top: 10, right: 8, left: -6, bottom: bottomMargin }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          {/* ── Zone bands — replaces all inline label clutter ── */}
          {/* Pelér zone: below −1.5 */}
          <ReferenceArea
            y1={-1.5} y2={-8}
            fill="#5090ff" fillOpacity={0.06}
            ifOverflow="visible"
          />
          {/* Ora zone: above +1.5 */}
          <ReferenceArea
            y1={1.5} y2={8}
            fill="#f5a428" fillOpacity={0.06}
            ifOverflow="visible"
          />

          <XAxis
            dataKey="time"
            ticks={ticks}
            height={xAxisHeight}
            tick={<SmartXTick tickMeta={tickMeta} />}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
          />

          {/* Y-axis: physics-meaningful ticks, no unit suffix per tick */}
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={v => (v === 0 ? '0' : (v > 0 ? `+${v}` : `${v}`))}
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Zero baseline */}
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />

          {/* Threshold lines — no labels, zones carry the meaning */}
          <ReferenceLine y={-1.5} stroke="#5090ff" strokeOpacity={0.35} strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={1.5}  stroke="#f5a428" strokeOpacity={0.35} strokeDasharray="4 3" strokeWidth={1} />

          {/* ~20 kn Pelér */}
          <ReferenceLine
            y={-3}
            stroke="#5090ff"
            strokeOpacity={0.5}
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{ value: '~20 kn', fill: 'rgba(80,144,255,0.55)', fontSize: 8, position: 'bottom' }}
          />
          {/* ~15 kn Ora (symmetric) */}
          <ReferenceLine
            y={3}
            stroke="#f5a428"
            strokeOpacity={0.5}
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{ value: '~15 kn', fill: 'rgba(245,164,40,0.55)', fontSize: 8, position: 'top' }}
          />

          {/* Now line */}
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
            <linearGradient id="dpFillNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#5090ff" stopOpacity={0} />
              <stop offset="100%" stopColor="#5090ff" stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="dpFillPos" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%"   stopColor="#f5a428" stopOpacity={0} />
              <stop offset="100%" stopColor="#f5a428" stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="dp"
            stroke="#a78bfa"
            strokeWidth={2}
            fill="url(#dpFillNeg)"
            dot={false}
            isAnimationActive={animate}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#5090ff99', fontWeight: 600 }}>↓ Pelér (N→S) · negative</span>
        <span style={{ fontSize: 10, color: '#f5a42899', fontWeight: 600 }}>positive · Ora (S→N) ↑</span>
      </div>
    </div>
  );
}
