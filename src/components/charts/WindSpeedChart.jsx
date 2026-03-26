import { useRef, useMemo } from 'react';
import {
  ComposedChart, Area, Line, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import { formatTime, getDayName, getRomeHour } from '../../utils/formatters.js';
import { QUALITY_COLORS } from '../../utils/constants.js';

// ── Smart two-line tick: day name on first tick of each day ──────
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
  const col = QUALITY_COLORS[d.quality] ?? QUALITY_COLORS.none;
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: col, lineHeight: 1 }}>
          {d.windSpeed !== null ? Math.round(d.windSpeed) : '—'}
        </span>
        <span style={{ fontSize: 9, color: '#4a6080' }}>kn</span>
      </div>
      {d.windGusts !== null && (
        <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>
          <span style={{ color: '#6a8099' }}>↑</span>
          {' '}
          <span className="font-num" style={{ color: '#7a9ab8' }}>{Math.round(d.windGusts)}</span>
          {' kn gusts'}
        </div>
      )}
    </div>
  );
};

export default function WindSpeedChart({ data = [], timeRange = '24h', liveHistory = [] }) {
  const hasRendered = useRef(false);

  const hours    = timeRange === '24h' ? 24 : timeRange === '48h' ? 48 : 168;
  const filtered = data.filter(d => d.diffH >= -2 && d.diffH <= hours);
  const nowEntry = data.find(d => d.isNow);

  // Build live dots: map each live reading to the chart x-axis (time string)
  // We match by finding the closest hourly entry time to anchor the scatter point.
  const livePoints = useMemo(() => {
    if (!liveHistory?.length || !filtered.length) return [];
    const cutoff = Date.now() - hours * 3600000;
    return liveHistory
      .filter(r => r?.windSpeedKn != null && r.time && new Date(r.time).getTime() >= cutoff)
      .map(r => {
        const rMs = new Date(r.time).getTime();
        // Find nearest hourly entry to use as x-axis anchor
        let nearest = filtered[0];
        let minDiff = Infinity;
        for (const entry of filtered) {
          const diff = Math.abs(new Date(entry.time).getTime() - rMs);
          if (diff < minDiff) { minDiff = diff; nearest = entry; }
        }
        return { time: nearest.time, liveSpeed: r.windSpeedKn };
      });
  }, [liveHistory, filtered, hours]);

  // ── Build tick metadata ──────────────────────────────────────
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

  const animate = !hasRendered.current;
  if (filtered.length > 0) hasRendered.current = true;

  // Merge live points into the chart data by time key for Scatter to work
  const chartData = useMemo(() => {
    if (!livePoints.length) return filtered;
    const liveMap = new Map(livePoints.map(p => [p.time, p.liveSpeed]));
    return filtered.map(d => ({
      ...d,
      liveSpeed: liveMap.get(d.time) ?? null,
    }));
  }, [filtered, livePoints]);

  const hasLive = livePoints.length > 0;

  return (
    <div className="card p-4">
      <div className="section-label" style={{ marginBottom: 12 }}>Wind Speed &amp; Gusts</div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: bottomMargin }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          <ReferenceArea y1={8}  y2={12} fill={QUALITY_COLORS.marginal}  fillOpacity={0.06} />
          <ReferenceArea y1={12} y2={22} fill={QUALITY_COLORS.good}      fillOpacity={0.07} />
          <ReferenceArea y1={22} y2={32} fill={QUALITY_COLORS.advanced}  fillOpacity={0.07} />
          <ReferenceArea y1={32} y2={60} fill={QUALITY_COLORS.storm}     fillOpacity={0.06} />

          <XAxis
            dataKey="time"
            ticks={ticks}
            height={xAxisHeight}
            tick={<SmartXTick tickMeta={tickMeta} />}
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
            <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4d8fff" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#4d8fff" stopOpacity={0.0}  />
            </linearGradient>
          </defs>
          <Area
            type="monotone" dataKey="windSpeed"
            stroke="#4d8fff" strokeWidth={2}
            fill="url(#windGrad)" dot={false}
            isAnimationActive={animate} connectNulls
          />
          <Line
            type="monotone" dataKey="windGusts"
            stroke="#f5a428" strokeWidth={1.5}
            strokeDasharray="4 3" dot={false}
            isAnimationActive={animate} connectNulls
          />
          {hasLive && (
            <Scatter
              dataKey="liveSpeed"
              fill="#0dcfa8"
              stroke="#0a1e2a"
              strokeWidth={1}
              r={4}
              isAnimationActive={false}
              name="Live"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-2 text-xs" style={{ color: '#324158' }}>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#4d8fff', borderRadius: 1 }} />
          Model
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: '2px dashed #f5a428' }} />
          Model gusts
        </span>
        {hasLive && (
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0dcfa8', border: '1px solid #0a1e2a' }} />
            Live observed
          </span>
        )}
      </div>
    </div>
  );
}
