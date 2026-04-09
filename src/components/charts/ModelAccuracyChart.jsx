import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import { formatTime, getRomeHour, getDayName } from '../../utils/formatters.js';

// ── Colour helpers ────────────────────────────────────────────────
const errColor = (absErr) => {
  if (absErr <= 3) return '#0dcfa8';
  if (absErr <= 6) return '#f5a428';
  return '#ff4d6d';
};

function reliabilityLabel(mae, n) {
  if (n < 5)    return { text: 'not enough data', color: '#4a6080' };
  if (mae <= 2) return { text: 'excellent',        color: '#0dcfa8' };
  if (mae <= 4) return { text: 'good',             color: '#56d67a' };
  if (mae <= 6) return { text: 'fair',             color: '#f5a428' };
  return          { text: 'poor',                  color: '#ff4d6d' };
}

// ── Match historical observation rows to hourly model entries ─────
// For each past hourly model entry, find the closest observation within ±30 min.
function buildPairs(hourlyPast, observations) {
  const WINDOW = 30 * 60 * 1000;
  return hourlyPast.map(entry => {
    const entryMs = new Date(entry.time).getTime();
    let closest = null, minDiff = Infinity;
    for (const obs of observations) {
      if (!obs?.ts || obs.actual_wind_kn == null) continue;
      const diff = Math.abs(new Date(obs.ts + (obs.ts.endsWith('Z') ? '' : 'Z')).getTime() - entryMs);
      if (diff < minDiff) { minDiff = diff; closest = obs; }
    }
    if (!closest || minDiff > WINDOW) return null;
    const err = entry.windSpeed - closest.actual_wind_kn;
    return {
      time:       entry.time,
      diffH:      entry.diffH,
      modelSpeed: entry.windSpeed,
      dpSpeed:    entry.estimatedWindFromDp ?? null,
      obsSpeed:   closest.actual_wind_kn,
      error:      err,
    };
  }).filter(Boolean);
}

// ── Aggregate stats over ALL historical observations ──────────────
function computeAllStats(observations) {
  const rows = observations.filter(
    r => r.actual_wind_kn != null && r.arome_wind_kn != null
  );
  if (!rows.length) return null;

  const errs = rows.map(r => r.arome_wind_kn - r.actual_wind_kn);
  const bias = errs.reduce((s, e) => s + e, 0) / errs.length;
  const mae  = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length;
  const rmse = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);

  // Per-regime breakdown
  const regimes = {};
  for (const r of rows) {
    const reg = r.regime ?? 'variable';
    if (!regimes[reg]) regimes[reg] = { errs: [], count: 0 };
    regimes[reg].errs.push(r.arome_wind_kn - r.actual_wind_kn);
    regimes[reg].count++;
  }
  const byRegime = Object.fromEntries(
    Object.entries(regimes).map(([reg, { errs: re, count }]) => [
      reg,
      {
        count,
        mae: re.reduce((s, e) => s + Math.abs(e), 0) / count,
        bias: re.reduce((s, e) => s + e, 0) / count,
      },
    ])
  );

  // Days of data
  const dates = new Set(rows.map(r => r.ts?.substring(0, 10)).filter(Boolean));

  return { bias, mae, rmse, n: rows.length, days: dates.size, byRegime };
}

// ── X-tick ───────────────────────────────────────────────────────
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
  return (
    <div style={{
      background: 'rgba(10,18,30,0.93)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `2px solid ${hasObs ? errColor(Math.abs(d.error ?? 0)) : '#4d8fff'}`,
      borderRadius: 6,
      padding: '5px 9px',
      pointerEvents: 'none',
      minWidth: 130,
    }}>
      <div style={{ fontSize: 9, color: '#4a6080', marginBottom: 4 }}>
        {formatTime(d.time)}
      </div>
      <div style={{ fontSize: 10, color: '#4d8fff', marginBottom: 2 }}>
        Model: <span className="font-num" style={{ fontWeight: 700 }}>
          {d.windSpeed != null ? Math.round(d.windSpeed) : '—'} kn
        </span>
      </div>
      {d.estimatedWindFromDp != null && (
        <div style={{ fontSize: 10, color: '#a05dfc', marginBottom: 2 }}>
          ΔP est.: <span className="font-num" style={{ fontWeight: 700 }}>
            {Math.round(d.estimatedWindFromDp)} kn
          </span>
        </div>
      )}
      {hasObs && (
        <>
          <div style={{ fontSize: 10, color: errColor(Math.abs(d.error ?? 0)), marginBottom: 2 }}>
            Observed: <span className="font-num" style={{ fontWeight: 700 }}>
              {Math.round(d.obsSpeed)} kn
            </span>
          </div>
          <div style={{ fontSize: 9, color: '#4a6080' }}>
            Error: {d.error > 0 ? '+' : ''}{(d.error ?? 0).toFixed(1)} kn
          </div>
        </>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────
/**
 * Props:
 *   data         — hourly model entries (from transform)
 *   observations — historical NDJSON rows from /api/observations
 *   loading      — true while observations are being fetched
 */
export default function ModelAccuracyChart({ data = [], observations = [], loading = false }) {
  // All-time stats from full history
  const allStats = useMemo(() => computeAllStats(observations), [observations]);
  const reliability = reliabilityLabel(allStats?.mae ?? Infinity, allStats?.n ?? 0);

  // Chart window: past 48h model entries + 6h ahead
  const chartRange = useMemo(
    () => data.filter(d => d.diffH >= -48 && d.diffH <= 6),
    [data]
  );
  const pastEntries = useMemo(
    () => chartRange.filter(d => d.diffH <= 0),
    [chartRange]
  );

  // Match observations to past hourly entries for chart dots
  const pairs = useMemo(
    () => buildPairs(pastEntries, observations),
    [pastEntries, observations]
  );

  const pairMap = useMemo(
    () => new Map(pairs.map(p => [p.time, p])),
    [pairs]
  );

  const chartData = useMemo(() =>
    chartRange.map(d => {
      const pair = pairMap.get(d.time);
      return {
        ...d,
        obsSpeed: pair?.obsSpeed ?? null,
        error:    pair?.error    ?? null,
        obsColor: pair != null ? errColor(Math.abs(pair.error)) : null,
      };
    }),
    [chartRange, pairMap]
  );

  const nowEntry = data.find(d => d.isNow);
  const hasObs = pairs.length > 0;

  // Ticks every 6 entries, day label at noon-closest tick
  const tickEntries = chartRange.filter((_, i) => i % 6 === 0);
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

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="section-label">Forecast Reliability · AROME vs Observed</div>
          {allStats ? (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>
              {allStats.n} paired readings · {allStats.days} day{allStats.days !== 1 ? 's' : ''} of data
            </div>
          ) : loading ? (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>loading history…</div>
          ) : (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>no history yet — check back later</div>
          )}
        </div>

        {/* Overall reliability badge */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: reliability.color, letterSpacing: '0.04em' }}>
            {reliability.text.toUpperCase()}
          </div>
          {allStats && (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 1 }}>
              bias {allStats.bias > 0 ? '+' : ''}{allStats.bias.toFixed(1)} · MAE {allStats.mae.toFixed(1)} · RMSE {allStats.rmse.toFixed(1)} kn
            </div>
          )}
        </div>
      </div>

      {/* ── Per-regime stats pills ── */}
      {allStats?.byRegime && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(allStats.byRegime).map(([regime, s]) => (
            <div key={regime} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 10,
            }}>
              <span style={{
                color: regime === 'peler' ? '#4d8fff' : regime === 'ora' ? '#f5a428' : '#8899aa',
                fontWeight: 600,
                marginRight: 6,
              }}>
                {regime === 'peler' ? 'Pelér' : regime === 'ora' ? 'Ora' : 'Variable'}
              </span>
              <span style={{ color: errColor(s.mae) }}>MAE {s.mae.toFixed(1)} kn</span>
              <span style={{ color: '#4a6080', marginLeft: 6 }}>n={s.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Chart: last 48h model vs observed ── */}
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          {/* Shade history zone */}
          {nowEntry && chartData[0] && (
            <ReferenceArea
              x1={chartData[0].time}
              x2={nowEntry.time}
              fill="rgba(255,255,255,0.02)"
              label={{
                value: '← history',
                position: 'insideTopLeft',
                fill: 'rgba(255,255,255,0.1)',
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
              <stop offset="5%"  stopColor="#4d8fff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4d8fff" stopOpacity={0}   />
            </linearGradient>
          </defs>

          {/* Model forecast */}
          <Area
            type="monotone" dataKey="windSpeed"
            stroke="#4d8fff" strokeWidth={2}
            fill="url(#accModelGrad)" dot={false}
            isAnimationActive={false} connectNulls
          />

          {/* ΔP physics estimate */}
          <Line
            type="monotone" dataKey="estimatedWindFromDp"
            stroke="#a05dfc" strokeWidth={1.5}
            strokeDasharray="5 4" dot={false}
            isAnimationActive={false} connectNulls
          />

          {/* Observed dots from history (coloured by error) */}
          {hasObs && (
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
                  <circle
                    key={`obs-${payload.time}`}
                    cx={cx} cy={cy} r={4.5}
                    fill={col} stroke="#0a1e2a" strokeWidth={1.5}
                  />
                );
              }}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── Legend ── */}
      <div className="flex gap-4 mt-2 text-xs" style={{ color: '#324158', flexWrap: 'wrap', rowGap: 4 }}>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#4d8fff', borderRadius: 1 }} />
          AROME model
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: '2px dashed #a05dfc' }} />
          ΔP estimate
        </span>
        {hasObs && (
          <>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#0dcfa8', border: '1px solid #0a1e2a' }} />
              ≤3 kn err
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#f5a428', border: '1px solid #0a1e2a' }} />
              3–6 kn
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#ff4d6d', border: '1px solid #0a1e2a' }} />
              &gt;6 kn
            </span>
          </>
        )}
      </div>

      {!hasObs && !loading && (
        <div style={{ fontSize: 10, color: '#4a6080', marginTop: 8, textAlign: 'center' }}>
          {observations.length > 0
            ? 'No observations in the last 48h window — check a longer period.'
            : 'Observation history will appear once data is logged for this station.'}
        </div>
      )}
    </div>
  );
}
