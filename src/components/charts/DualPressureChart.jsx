import { useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { formatTime } from '../../utils/formatters.js';

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

/**
 * Dual pressure chart showing Bolzano vs Ghedi absolute pressures
 * Props: { data: array }
 */
export default function DualPressureChart({ data = [] }) {
  const hasRendered = useRef(false);

  const filtered = data.filter(
    d => d.bolzanoPressure !== null && d.ghediPressure !== null && d.diffH >= -2 && d.diffH <= 48
  );

  const nowEntry = data.find(d => d.isNow);

  const step = Math.max(1, Math.floor(filtered.length / 7));
  const ticks = filtered.filter((_, i) => i % step === 0).map(d => d.time);
  const tickFormatter = (val) => {
    const entry = filtered.find(d => d.time === val);
    return entry ? formatTime(entry.time) : '';
  };

  // Auto-scale: find min/max across both series
  const allPressures = filtered.flatMap(d => [d.bolzanoPressure, d.ghediPressure]).filter(Boolean);
  const minP = allPressures.length ? Math.floor(Math.min(...allPressures) - 1) : 1005;
  const maxP = allPressures.length ? Math.ceil(Math.max(...allPressures) + 1) : 1025;

  const animate = !hasRendered.current;
  if (filtered.length > 0) hasRendered.current = true;

  return (
    <div className="card p-4">
      <div className="section-label" style={{ marginBottom: 12 }}>Bolzano vs Ghedi · Absolute Pressure</div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={filtered} margin={{ top: 4, right: 8, left: -15, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            ticks={ticks}
            tickFormatter={tickFormatter}
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            domain={[minP, maxP]}
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#324158', paddingTop: 4 }}
            formatter={(val) => val === 'bolzanoPressure' ? 'Bolzano' : 'Ghedi'}
          />

          {nowEntry && (
            <ReferenceLine
              x={nowEntry.time}
              stroke="rgba(255,255,255,0.25)"
              strokeDasharray="4 3"
            />
          )}

          <Line
            type="monotone"
            dataKey="bolzanoPressure"
            stroke="#4d8fff"
            strokeWidth={2}
            dot={false}
            isAnimationActive={animate}
            connectNulls
            name="Bolzano"
          />
          <Line
            type="monotone"
            dataKey="ghediPressure"
            stroke="#f5a623"
            strokeWidth={2}
            dot={false}
            isAnimationActive={animate}
            connectNulls
            name="Ghedi"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
