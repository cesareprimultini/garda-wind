import { useRef, useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import { formatTime, getDayName } from '../../utils/formatters.js';
import { QUALITY_COLORS } from '../../utils/constants.js';

const WINDOW_DAYS = 7;
const PX_PER_DAY  = 220;

// ── X-tick: matching ModelAccuracyChart style ─────────────────────
// Forecast times are Rome-local strings ("2026-04-09T12:00") from Open-Meteo.
// substring(11,13) gives the Rome hour directly — no UTC conversion needed.
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
      {d.liveSpeed != null && (
        <div style={{ fontSize: 9, color: '#0dcfa8', marginTop: 3, fontWeight: 600 }}>
          ● {Math.round(d.liveSpeed)} kn live
        </div>
      )}
    </div>
  );
};

export default function WindSpeedChart({ data = [], liveHistory = [] }) {
  const scrollRef = useRef(null);

  const filtered = data.filter(d => d.diffH >= -2 && d.diffH <= WINDOW_DAYS * 24);
  const nowEntry = data.find(d => d.isNow);

  // Live dots merged into chart data
  const livePoints = useMemo(() => {
    if (!liveHistory?.length || !filtered.length) return [];
    const cutoff = Date.now() - WINDOW_DAYS * 24 * 3600000;
    return liveHistory
      .filter(r => r?.windSpeedKn != null && r.time && new Date(r.time).getTime() >= cutoff)
      .map(r => {
        const rMs = new Date(r.time).getTime();
        let nearest = filtered[0];
        let minDiff = Infinity;
        for (const entry of filtered) {
          const diff = Math.abs(new Date(entry.time).getTime() - rMs);
          if (diff < minDiff) { minDiff = diff; nearest = entry; }
        }
        return { time: nearest.time, liveSpeed: r.windSpeedKn };
      });
  }, [liveHistory, filtered]);

  const chartData = useMemo(() => {
    if (!livePoints.length) return filtered;
    const liveMap = new Map(livePoints.map(p => [p.time, p.liveSpeed]));
    return filtered.map(d => ({ ...d, liveSpeed: liveMap.get(d.time) ?? null }));
  }, [filtered, livePoints]);

  // Ticks at midnight (h=0) and noon (h=12) — one per day each
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
  const hasLive = livePoints.length > 0;

  return (
    <div className="card p-4">
      <div className="section-label" style={{ marginBottom: 12 }}>Wind Speed &amp; Gusts</div>

      <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}>
        <ComposedChart
          width={chartW} height={200} data={chartData}
          margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          <ReferenceArea y1={8}  y2={12} fill={QUALITY_COLORS.marginal}  fillOpacity={0.06} />
          <ReferenceArea y1={12} y2={22} fill={QUALITY_COLORS.good}      fillOpacity={0.07} />
          <ReferenceArea y1={22} y2={32} fill={QUALITY_COLORS.advanced}  fillOpacity={0.07} />
          <ReferenceArea y1={32} y2={60} fill={QUALITY_COLORS.storm}     fillOpacity={0.06} />

          {midnightTimes.map(t => (
            <ReferenceLine key={'d-' + t} x={t} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          ))}

          {nowEntry && (
            <ReferenceLine
              x={nowEntry.time}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: 'now', fill: 'rgba(255,255,255,0.35)', fontSize: 8, position: 'insideTopRight' }}
            />
          )}

          <XAxis
            dataKey="time"
            ticks={ticks}
            height={34}
            tick={<XTick />}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.10)', strokeWidth: 1 }}
          />
          <YAxis
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 'auto']}
            unit=" kn"
          />
          <Tooltip content={<CustomTooltip />} />

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
            isAnimationActive={false} connectNulls
          />
          <Line
            type="monotone" dataKey="windGusts"
            stroke="#f5a428" strokeWidth={1.5}
            strokeDasharray="4 3" dot={false}
            isAnimationActive={false} connectNulls
          />
          {hasLive && (
            <Line
              type="monotone"
              dataKey="liveSpeed"
              stroke="transparent"
              strokeWidth={0}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.liveSpeed == null) return null;
                return (
                  <circle
                    key={`live-${payload.time}`}
                    cx={cx} cy={cy} r={4}
                    fill="#0dcfa8" stroke="#0a1e2a" strokeWidth={1.5}
                  />
                );
              }}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </div>

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
