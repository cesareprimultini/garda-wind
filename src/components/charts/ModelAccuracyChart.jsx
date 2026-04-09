import { useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import { getDayName } from '../../utils/formatters.js';

// ── Constants ─────────────────────────────────────────────────────
const WINDOW_H     = 7 * 24;   // 7 days past
const FUTURE_H     = 6;        // 6 h of forecast shown
const PX_PER_DAY   = 220;      // chart pixel width per day (scrollable)

// Simple continuous ΔP → knots conversion (no time-of-day suppression).
// Calibrated to the same anchor points as getDpInterpretation:
//   |dp| = 1.5 hPa → ~10 kn,  |dp| = 3 hPa → ~20 kn  (slope ≈ 6.7 kn/hPa)
// Using magnitude only so the line is always non-null and directly comparable
// to the wind axis. Regime (Pelér vs Ora) is shown in the tooltip via dp sign.
function dpToKn(dp) {
  if (dp == null) return null;
  return Math.round(Math.abs(dp) * 6.7);
}

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

// ── Aggregate stats (all history, not just the 7-day window) ──────
function computeAllStats(observations) {
  const rows = observations.filter(
    r => r.actual_wind_kn != null && r.arome_wind_kn != null
  );
  if (!rows.length) return null;

  const errs = rows.map(r => r.arome_wind_kn - r.actual_wind_kn);
  const bias = errs.reduce((s, e) => s + e, 0) / errs.length;
  const mae  = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length;
  const rmse = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);

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
        mae:  re.reduce((s, e) => s + Math.abs(e), 0) / count,
        bias: re.reduce((s, e) => s + e, 0) / count,
      },
    ])
  );

  const dates = new Set(rows.map(r => r.ts?.substring(0, 10)).filter(Boolean));
  return { bias, mae, rmse, n: rows.length, days: dates.size, byRegime };
}

// ── Match observations → hourly model entries (±30 min window) ────
// Each observation row has actual_wind_kn; the model entry provides its
// own dp and windSpeed. We just need to attach the observed value.
function buildPairs(pastEntries, observations) {
  const WINDOW = 30 * 60 * 1000;
  const pairs = new Map(); // time → { obsSpeed, error }
  for (const entry of pastEntries) {
    const entryMs = new Date(entry.time).getTime();
    let closest = null, minDiff = Infinity;
    for (const obs of observations) {
      if (!obs?.ts || obs.actual_wind_kn == null) continue;
      const ts  = obs.ts.endsWith('Z') ? obs.ts : obs.ts + 'Z';
      const diff = Math.abs(new Date(ts).getTime() - entryMs);
      if (diff < minDiff) { minDiff = diff; closest = obs; }
    }
    if (closest && minDiff <= WINDOW) {
      const err = entry.windSpeed - closest.actual_wind_kn;
      pairs.set(entry.time, { obsSpeed: closest.actual_wind_kn, error: err });
    }
  }
  return pairs;
}

// ── X-tick: day name at midnight (h=00), dim "12" at noon (h=12) ──
// Open-Meteo returns time strings in Rome local time ("2026-04-09T00:00"),
// so extracting the hour substring directly gives the Rome hour.
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

// ── Tooltip ──────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const hasObs = d.obsSpeed != null;
  const hasDp  = d.dp != null;
  return (
    <div style={{
      background: 'rgba(10,18,30,0.95)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `2px solid ${hasObs ? errColor(Math.abs(d.error ?? 0)) : '#4d8fff'}`,
      borderRadius: 6,
      padding: '5px 9px',
      pointerEvents: 'none',
      minWidth: 140,
      fontSize: 10,
    }}>
      <div style={{ fontSize: 9, color: '#4a6080', marginBottom: 4 }}>
        {d.time?.replace('T', ' ')}
      </div>
      <div style={{ color: '#4d8fff', marginBottom: 2 }}>
        AROME: <b>{d.windSpeed != null ? Math.round(d.windSpeed) : '—'} kn</b>
      </div>
      {hasObs && (
        <>
          <div style={{ color: errColor(Math.abs(d.error ?? 0)), marginBottom: 2 }}>
            Observed: <b>{Math.round(d.obsSpeed)} kn</b>
          </div>
          <div style={{ color: '#4a6080' }}>
            Error: {d.error > 0 ? '+' : ''}{(d.error ?? 0).toFixed(1)} kn
          </div>
        </>
      )}
      {d.dpKn != null && (
        <div style={{ color: '#a05dfc', marginTop: hasObs ? 4 : 2 }}>
          ΔP est.: <b>{d.dpKn} kn</b>
          <span style={{ marginLeft: 6, color: '#4a6080' }}>
            {d.dp < -1.5 ? 'Pelér' : d.dp > 1.5 ? 'Ora' : 'Variable'}
          </span>
        </div>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────
export default function ModelAccuracyChart({ data = [], observations = [], loading = false }) {
  const scrollRef = useRef(null);

  // All-time stats
  const allStats    = useMemo(() => computeAllStats(observations), [observations]);
  const reliability = reliabilityLabel(allStats?.mae ?? Infinity, allStats?.n ?? 0);

  // Chart window: past 7 days + 6h forecast
  const chartRange = useMemo(
    () => data.filter(d => d.diffH >= -WINDOW_H && d.diffH <= FUTURE_H),
    [data]
  );
  const pastEntries = useMemo(
    () => chartRange.filter(d => d.diffH <= 0),
    [chartRange]
  );

  // Match observations to model entries
  const pairMap = useMemo(
    () => buildPairs(pastEntries, observations),
    [pastEntries, observations]
  );

  // Merge into chart data
  const chartData = useMemo(() =>
    chartRange.map(d => {
      const pair = pairMap.get(d.time);
      return {
        ...d,
        obsSpeed: pair?.obsSpeed ?? null,
        error:    pair?.error    ?? null,
        obsColor: pair ? errColor(Math.abs(pair.error ?? 0)) : null,
        dpKn:     dpToKn(d.dp),
      };
    }),
    [chartRange, pairMap]
  );

  const hasObs   = chartData.some(d => d.obsSpeed != null);
  const hasDpEst = chartData.some(d => d.dpKn != null);
  const nowEntry  = chartData.find(d => d.isNow);

  // Ticks: Rome midnight (h=00) and noon (h=12)
  // Open-Meteo time strings are in Rome local time — extract hour from string directly.
  const { ticks, midnightTimes } = useMemo(() => {
    const ticks = [];
    const midnightTimes = [];
    for (const e of chartRange) {
      const h = parseInt(e.time.substring(11, 13), 10);
      if (h === 0 || h === 12) ticks.push(e.time);
      if (h === 0) midnightTimes.push(e.time);
    }
    return { ticks, midnightTimes };
  }, [chartRange]);

  // Chart pixel width (scrollable)
  const chartW = useMemo(() => {
    const days = Math.ceil(chartRange.length / 24);
    return Math.max(days * PX_PER_DAY, 400);
  }, [chartRange.length]);

  // Auto-scroll to the right (most recent) on mount / data change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [chartData.length]);

  if (!chartRange.length) return null;

  return (
    <div className="card p-4">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="section-label">Forecast Reliability · AROME vs Observed</div>
          {allStats ? (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>
              {allStats.n} readings · {allStats.days} day{allStats.days !== 1 ? 's' : ''} of history
            </div>
          ) : loading ? (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>loading history…</div>
          ) : (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>no history yet — check back later</div>
          )}
        </div>
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

      {/* ── Per-regime pills ── */}
      {allStats?.byRegime && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(allStats.byRegime).map(([regime, s]) => (
            <div key={regime} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, padding: '4px 10px', fontSize: 10,
            }}>
              <span style={{
                color: regime === 'peler' ? '#4d8fff' : regime === 'ora' ? '#f5a428' : '#8899aa',
                fontWeight: 600, marginRight: 6,
              }}>
                {regime === 'peler' ? 'Pelér' : regime === 'ora' ? 'Ora' : 'Variable'}
              </span>
              <span style={{ color: errColor(s.mae) }}>MAE {s.mae.toFixed(1)} kn</span>
              <span style={{ color: '#4a6080', marginLeft: 6 }}>n={s.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Scrollable chart ── */}
      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}
      >
        <ComposedChart
          width={chartW}
          height={210}
          data={chartData}
          margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          {/* Day separator lines at each Rome midnight */}
          {midnightTimes.map(t => (
            <ReferenceLine key={'d-' + t} x={t} yAxisId="wind"
              stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          ))}

          {/* "now" dashed line */}
          {nowEntry && (
            <ReferenceLine x={nowEntry.time} yAxisId="wind"
              stroke="rgba(255,255,255,0.28)" strokeWidth={1} strokeDasharray="3 3"
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

          {/* Wind axis (shared by model, ΔP estimate, and observed) */}
          <YAxis yAxisId="wind" orientation="left"
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={false} tickLine={false}
            domain={[0, 'auto']} unit=" kn"
          />

          <Tooltip content={<CustomTooltip />} />

          <defs>
            <linearGradient id="accModelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4d8fff" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#4d8fff" stopOpacity={0}    />
            </linearGradient>
          </defs>

          {/* AROME model wind */}
          <Area yAxisId="wind"
            type="monotone" dataKey="windSpeed"
            stroke="#4d8fff" strokeWidth={1.5}
            fill="url(#accModelGrad)" dot={false}
            isAnimationActive={false} connectNulls
          />

          {/* ΔP estimated wind — continuous magnitude, same axis */}
          {hasDpEst && (
            <Line yAxisId="wind"
              type="monotone" dataKey="dpKn"
              stroke="#a05dfc" strokeWidth={1.5} strokeDasharray="5 3"
              dot={false} isAnimationActive={false} connectNulls
            />
          )}

          {/* Observed wind — coloured dots only, no line */}
          {hasObs && (
            <Line yAxisId="wind"
              type="monotone" dataKey="obsSpeed"
              stroke="transparent" strokeWidth={0}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.obsSpeed == null) return null;
                return (
                  <circle key={`o-${payload.time}`}
                    cx={cx} cy={cy} r={3.5}
                    fill={payload.obsColor ?? '#0dcfa8'}
                    stroke="#0a1e2a" strokeWidth={1}
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

      {/* ── Legend ── */}
      <div className="flex gap-4 mt-2 text-xs" style={{ color: '#324158', flexWrap: 'wrap', rowGap: 4 }}>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#4d8fff', borderRadius: 1 }} />
          AROME model
        </span>
        {hasDpEst && (
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: '2px dashed #a05dfc' }} />
            ΔP est. (kn)
          </span>
        )}
        {hasObs && (
          <>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0dcfa8', border: '1px solid #0a1e2a' }} />
              ≤3 kn err
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f5a428', border: '1px solid #0a1e2a' }} />
              3–6 kn
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ff4d6d', border: '1px solid #0a1e2a' }} />
              &gt;6 kn
            </span>
          </>
        )}
      </div>

      {!hasObs && !loading && (
        <div style={{ fontSize: 10, color: '#4a6080', marginTop: 8, textAlign: 'center' }}>
          {observations.length > 0
            ? 'No matched observations in the 7-day window.'
            : 'Observation history will appear once data is logged for this station.'}
        </div>
      )}
    </div>
  );
}
