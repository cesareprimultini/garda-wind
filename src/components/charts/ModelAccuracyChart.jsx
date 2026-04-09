import { useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import { getDayName, getRomeHour } from '../../utils/formatters.js';

// ── Constants ─────────────────────────────────────────────────────
const WINDOW_DAYS  = 7;
const PX_PER_DAY   = 220;

// Continuous ΔP → knots (no time-of-day suppression so the line is always present).
// Anchors: |dp|=1.5 hPa → 10 kn, |dp|=3 hPa → 20 kn (slope ≈ 6.7 kn/hPa).
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

// ── All-time stats ────────────────────────────────────────────────
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
      { count, mae: re.reduce((s, e) => s + Math.abs(e), 0) / count,
               bias: re.reduce((s, e) => s + e, 0) / count },
    ])
  );
  const dates = new Set(rows.map(r => r.ts?.substring(0, 10)).filter(Boolean));
  return { bias, mae, rmse, n: rows.length, days: dates.size, byRegime };
}

// ── X-tick ────────────────────────────────────────────────────────
function XTick({ x, y, payload }) {
  if (!payload?.value) return null;
  const h = getRomeHour(payload.value);
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
  const hasErr = d.error != null;
  return (
    <div style={{
      background: 'rgba(10,18,30,0.95)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `2px solid ${hasErr ? errColor(Math.abs(d.error)) : '#4d8fff'}`,
      borderRadius: 6, padding: '5px 9px', pointerEvents: 'none', minWidth: 140, fontSize: 10,
    }}>
      <div style={{ fontSize: 9, color: '#4a6080', marginBottom: 4 }}>
        {new Date(d.time).toLocaleString('en-GB', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
        })}
      </div>
      {d.windSpeed != null && (
        <div style={{ color: '#4d8fff', marginBottom: 2 }}>
          AROME: <b>{Math.round(d.windSpeed)} kn</b>
        </div>
      )}
      {d.obsSpeed != null && (
        <>
          <div style={{ color: hasErr ? errColor(Math.abs(d.error)) : '#fff', marginBottom: 2 }}>
            Observed: <b>{Math.round(d.obsSpeed)} kn</b>
          </div>
          {hasErr && (
            <div style={{ color: '#4a6080' }}>
              Error: {d.error > 0 ? '+' : ''}{d.error.toFixed(1)} kn
            </div>
          )}
        </>
      )}
      {d.dpKn != null && (
        <div style={{ color: '#a05dfc', marginTop: 4 }}>
          ΔP est.: <b>{d.dpKn} kn</b>
          {d.dp_hpa != null && (
            <span style={{ marginLeft: 6, color: '#4a6080' }}>
              {d.dp_hpa < -1.5 ? 'Pelér' : d.dp_hpa > 1.5 ? 'Ora' : 'Variable'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────
// `data` prop kept for API compatibility but chart is now fully observation-driven:
// each NDJSON row already contains actual_wind_kn, arome_wind_kn, and dp_hpa,
// so no null-filled model-backbone entries are needed.
export default function ModelAccuracyChart({ data = [], observations = [], loading = false }) {
  const scrollRef = useRef(null);

  const allStats    = useMemo(() => computeAllStats(observations), [observations]);
  const reliability = reliabilityLabel(allStats?.mae ?? Infinity, allStats?.n ?? 0);

  // Build chart data directly from observation rows — obsSpeed is never null.
  const chartData = useMemo(() => {
    const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

    // Deduplicate by ts
    const obsMap = new Map();
    for (const r of observations) {
      const ts = r.ts?.endsWith('Z') ? r.ts : r.ts + 'Z';
      if (!obsMap.has(ts)) obsMap.set(ts, r);
    }

    return [...obsMap.values()]
      .filter(r => {
        if (r.actual_wind_kn == null) return false;
        const ms = new Date(r.ts?.endsWith('Z') ? r.ts : r.ts + 'Z').getTime();
        return ms >= cutoff;
      })
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .map(r => {
        const ts  = r.ts?.endsWith('Z') ? r.ts : r.ts + 'Z';
        const err = r.arome_wind_kn != null ? r.arome_wind_kn - r.actual_wind_kn : null;
        return {
          time:      ts,
          obsSpeed:  r.actual_wind_kn,        // always non-null
          windSpeed: r.arome_wind_kn ?? null,  // AROME at obs time (from log)
          dpKn:      dpToKn(r.dp_hpa),         // ΔP at obs time (from log)
          dp_hpa:    r.dp_hpa ?? null,
          error:     err,
          obsColor:  err != null ? errColor(Math.abs(err)) : null,
        };
      });
  }, [observations]);

  const hasObs   = chartData.length > 0;
  const hasDpEst = chartData.some(d => d.dpKn != null);
  const lastTime = chartData.at(-1)?.time ?? null;

  // Ticks at first entry per Rome-day at hour 0 (midnight) and hour 12 (noon).
  // Observation times are UTC strings — getRomeHour handles the conversion.
  const { ticks, midnightTimes } = useMemo(() => {
    const ticks = [], midnightTimes = [];
    const seen  = new Set();
    for (const e of chartData) {
      const h   = getRomeHour(e.time);
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })
        .format(new Date(e.time)); // "YYYY-MM-DD" in Rome
      if (h === 0) {
        const k = day + '-mid';
        if (!seen.has(k)) { seen.add(k); ticks.push(e.time); midnightTimes.push(e.time); }
      } else if (h === 12) {
        const k = day + '-noon';
        if (!seen.has(k)) { seen.add(k); ticks.push(e.time); }
      }
    }
    return { ticks, midnightTimes };
  }, [chartData]);

  const chartW = Math.max(WINDOW_DAYS * PX_PER_DAY, 400);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [chartData.length]);

  if (!chartData.length) return null;

  return (
    <div className="card p-4">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="section-label">Forecast Reliability</div>
          {allStats ? (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>
              {allStats.n} readings · {allStats.days} day{allStats.days !== 1 ? 's' : ''} of history
            </div>
          ) : loading ? (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>loading history…</div>
          ) : (
            <div style={{ fontSize: 9, color: '#4a6080', marginTop: 2 }}>no history yet</div>
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

      {/* ── Per-regime pills (Pelér + Ora only) ── */}
      {allStats?.byRegime && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(allStats.byRegime)
            .filter(([r]) => r !== 'variable')
            .map(([regime, s]) => (
              <div key={regime} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 6, padding: '4px 10px', fontSize: 10,
              }}>
                <span style={{ color: regime === 'peler' ? '#4d8fff' : '#f5a428', fontWeight: 600, marginRight: 6 }}>
                  {regime === 'peler' ? 'Pelér' : 'Ora'}
                </span>
                <span style={{ color: errColor(s.mae) }}>MAE {s.mae.toFixed(1)} kn</span>
                <span style={{ color: '#4a6080', marginLeft: 6 }}>n={s.count}</span>
              </div>
            ))}
        </div>
      )}

      {/* ── Scrollable chart ── */}
      <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}>
        <ComposedChart
          width={chartW} height={210} data={chartData}
          margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          {midnightTimes.map(t => (
            <ReferenceLine key={'d-' + t} x={t} yAxisId="wind"
              stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          ))}

          {lastTime && (
            <ReferenceLine x={lastTime} yAxisId="wind"
              stroke="rgba(255,255,255,0.28)" strokeWidth={1} strokeDasharray="3 3"
              label={{ value: 'now', fill: 'rgba(255,255,255,0.35)', fontSize: 8, position: 'insideTopRight' }}
            />
          )}

          <XAxis dataKey="time" ticks={ticks} height={34}
            tick={<XTick />}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.10)', strokeWidth: 1 }}
          />
          <YAxis yAxisId="wind" orientation="left"
            tick={{ fill: '#324158', fontSize: 10 }}
            axisLine={false} tickLine={false} domain={[0, 'auto']} unit=" kn"
          />
          <Tooltip content={<CustomTooltip />} />

          <defs>
            <linearGradient id="accModelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4d8fff" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#4d8fff" stopOpacity={0}    />
            </linearGradient>
          </defs>

          {/* AROME model wind */}
          <Area yAxisId="wind" type="monotone" dataKey="windSpeed"
            stroke="#4d8fff" strokeWidth={1.5} fill="url(#accModelGrad)"
            dot={false} isAnimationActive={false} connectNulls
          />

          {/* ΔP estimated wind */}
          {hasDpEst && (
            <Line yAxisId="wind" type="monotone" dataKey="dpKn"
              stroke="#a05dfc" strokeWidth={1.5} strokeDasharray="5 3"
              dot={false} isAnimationActive={false} connectNulls
            />
          )}

          {/* Observed wind — neutral dots, subtle connecting line, no nulls */}
          {hasObs && (
            <Line yAxisId="wind" type="monotone" dataKey="obsSpeed"
              stroke="rgba(255,255,255,0.18)" strokeWidth={1}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.obsSpeed == null) return null;
                return (
                  <circle key={`o-${payload.time}`} cx={cx} cy={cy} r={3}
                    fill="rgba(255,255,255,0.72)" stroke="rgba(255,255,255,0.18)" strokeWidth={1}
                  />
                );
              }}
              activeDot={false} isAnimationActive={false} connectNulls={false}
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
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.18)' }} />
            Observed
          </span>
        )}
      </div>
    </div>
  );
}
