import { useRef, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { formatTime, getDayName } from '../../utils/formatters.js';

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
  return (
    <div
      className="card px-3 py-2 text-xs"
      style={{ border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <div className="font-medium mb-1" style={{ color: '#6a8099' }}>
        {formatTime(d.time)}
      </div>
      {d.bolzanoPressure !== null && (
        <div style={{ color: '#4d8fff' }}>
          Bolzano: <span className="font-num">{d.bolzanoPressure?.toFixed(1)} hPa</span>
        </div>
      )}
      {d.ghediPressure !== null && (
        <div style={{ color: '#f5a623' }}>
          Ghedi: <span className="font-num">{d.ghediPressure?.toFixed(1)} hPa</span>
        </div>
      )}
      {d.dp !== null && (
        <div style={{ color: '#324158' }}>
          ΔP: <span className="font-num" style={{ color: d.dp < 0 ? '#4d8fff' : '#f5a623' }}>
            {d.dp >= 0 ? '+' : '\u2212'}{Math.abs(d.dp).toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
};

export default function DualPressureChart({ data = [] }) {
  const scrollRef = useRef(null);

  const filtered = data.filter(
    d => d.bolzanoPressure !== null && d.ghediPressure !== null && d.diffH >= -2 && d.diffH <= WINDOW_DAYS * 24
  );
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

  // Auto-scale: find min/max across both series
  const allPressures = filtered.flatMap(d => [d.bolzanoPressure, d.ghediPressure]).filter(Boolean);
  const minP = allPressures.length ? Math.floor(Math.min(...allPressures) - 1) : 1005;
  const maxP = allPressures.length ? Math.ceil(Math.max(...allPressures) + 1) : 1025;

  const chartW = WINDOW_DAYS * PX_PER_DAY;

  return (
    <div className="card p-4">
      <div className="section-label" style={{ marginBottom: 12 }}>Bolzano vs Ghedi · Absolute Pressure</div>

      <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}>
        <ComposedChart
          width={chartW} height={150} data={filtered}
          margin={{ top: 4, right: 8, left: -15, bottom: 4 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          {midnightTimes.map(t => (
            <ReferenceLine key={'d-' + t} x={t} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          ))}

          {nowEntry && (
            <ReferenceLine
              x={nowEntry.time}
              stroke="rgba(255,255,255,0.25)"
              strokeDasharray="4 3"
            />
          )}

          <XAxis
            dataKey="time"
            ticks={ticks}
            height={34}
            tick={<XTick />}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.10)', strokeWidth: 1 }}
          />
          <YAxis
            domain={[minP, maxP]}
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="bolzanoPressure"
            stroke="#4d8fff"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
            name="Bolzano"
          />
          <Line
            type="monotone"
            dataKey="ghediPressure"
            stroke="#f5a623"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
            name="Ghedi"
          />
        </ComposedChart>
      </div>

      <div className="flex gap-4 mt-2 text-xs" style={{ color: '#324158' }}>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#4d8fff', borderRadius: 1 }} />
          Bolzano
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#f5a623', borderRadius: 1 }} />
          Ghedi
        </span>
      </div>
    </div>
  );
}
