import { useRef, useMemo } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import { formatTime, formatDp, getDayName } from '../../utils/formatters.js';
import { getDpInterpretation } from '../../utils/windPhysics.js';

const WINDOW_DAYS = 7;
const PX_PER_DAY  = 220;

// ── X-tick: matching ModelAccuracyChart style ─────────────────────
function XTick({ x, y, payload }) {
  if (!payload?.value) return null;
  const h = parseInt(payload.value.substring(11, 13), 10);
  if (h === 0) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={14} textAnchor="middle" fill="#2a4060" fontSize={9}>00:00</text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={11} textAnchor="middle" fill="#4a6080" fontSize={9} fontWeight={600}>
        {getDayName(payload.value)}
      </text>
      <text x={0} y={23} textAnchor="middle" fill="#2a4060" fontSize={9}>12:00</text>
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

export default function DeltaPressureChart({ data = [] }) {
  const scrollRef = useRef(null);

  const filtered = data.filter(d => d.dp !== null && d.diffH >= -2 && d.diffH <= WINDOW_DAYS * 24);
  const nowEntry = data.find(d => d.isNow);

  // Ticks at midnight and noon — one per day each
  const { ticks, midnightTimes } = useMemo(() => {
    const ticks = [], midnightTimes = [];
    const seen  = new Set();
    for (const e of filtered) {
      const h   = parseInt(e.time.substring(11, 13), 10);
      const day = e.time.substring(0, 10);
      if (h === 0) {
        const k = day + '-mid';
        if (!seen.has(k)) { seen.add(k); ticks.push(e.time); midnightTimes.push(e.time); }
      } else if (h === 12) {
        const k = day + '-noon';
        if (!seen.has(k)) { seen.add(k); ticks.push(e.time); }
      }
    }
    return { ticks, midnightTimes };
  }, [filtered]);

  const chartW  = WINDOW_DAYS * PX_PER_DAY;
  const yTicks  = [-6, -3, 0, 3, 6];
  const yDomain = [-8, 8];

  return (
    <div className="card p-4">
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>
        ΔP Pressure Differential
        <span style={{ fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>hPa</span>
      </div>

      <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}>
        <ComposedChart
          width={chartW} height={180} data={filtered}
          margin={{ top: 10, right: 8, left: -6, bottom: 4 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          <ReferenceArea y1={-1.5} y2={-8} fill="#5090ff" fillOpacity={0.06} ifOverflow="visible" />
          <ReferenceArea y1={1.5}  y2={8}  fill="#f5a428" fillOpacity={0.06} ifOverflow="visible" />

          {midnightTimes.map(t => (
            <ReferenceLine key={'d-' + t} x={t} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          ))}

          <XAxis
            dataKey="time"
            ticks={ticks}
            height={34}
            tick={<XTick />}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.10)', strokeWidth: 1 }}
          />
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

          <ReferenceLine y={0}    stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
          <ReferenceLine y={-1.5} stroke="#5090ff" strokeOpacity={0.35} strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={1.5}  stroke="#f5a428" strokeOpacity={0.35} strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine
            y={-3}
            stroke="#5090ff" strokeOpacity={0.5} strokeDasharray="6 3" strokeWidth={1}
            label={{ value: '~20 kn', fill: 'rgba(80,144,255,0.55)', fontSize: 8, position: 'bottom' }}
          />
          <ReferenceLine
            y={3}
            stroke="#f5a428" strokeOpacity={0.5} strokeDasharray="6 3" strokeWidth={1}
            label={{ value: '~15 kn', fill: 'rgba(245,164,40,0.55)', fontSize: 8, position: 'top' }}
          />

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
          </defs>
          <Area
            type="monotone"
            dataKey="dp"
            stroke="#a78bfa"
            strokeWidth={2}
            fill="url(#dpFillNeg)"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#5090ff99', fontWeight: 600 }}>↓ Pelér (N→S) · negative</span>
        <span style={{ fontSize: 10, color: '#f5a42899', fontWeight: 600 }}>positive · Ora (S→N) ↑</span>
      </div>
    </div>
  );
}
