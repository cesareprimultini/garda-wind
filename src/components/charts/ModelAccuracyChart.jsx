import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { getRomeHour, getDayName } from '../../utils/formatters.js';

const WINDOW_DAYS = 7;

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

// ── Build unified chart data from observation log + future model ──
// Each observation row already has actual_wind_kn AND arome_wind_kn,
// so we don't need to join against the model hourly array for the past.
// For the future (+6h) we append entries from the model data prop.
function buildChartData(observations, modelData) {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const nowMs  = Date.now();

  // Deduplicate by ts (in case two cron runs in same minute produced duplicates)
  const obsMap = new Map();
  for (const r of observations) {
    const ts = r.ts?.endsWith('Z') ? r.ts : (r.ts + 'Z');
    if (!obsMap.has(ts)) obsMap.set(ts, r);
  }

  const past = [...obsMap.values()]
    .filter(r => {
      const ms = new Date(r.ts?.endsWith('Z') ? r.ts : r.ts + 'Z').getTime();
      return ms >= cutoff && ms <= nowMs + 5 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .map(r => {
      const ts  = r.ts?.endsWith('Z') ? r.ts : r.ts + 'Z';
      const err = r.arome_wind_kn != null && r.actual_wind_kn != null
        ? r.arome_wind_kn - r.actual_wind_kn : null;
      return {
        time:       ts,
        obsSpeed:   r.actual_wind_kn  ?? null,
        modelSpeed: r.arome_wind_kn   ?? null,
        error:      err,
        obsColor:   err != null ? errColor(Math.abs(err)) : null,
        isFuture:   false,
      };
    });

  const future = (modelData ?? [])
    .filter(d => d.diffH > 0 && d.diffH <= 6)
    .map(d => ({
      time:       d.time,
      obsSpeed:   null,
      modelSpeed: d.windSpeed ?? null,
      error:      null,
      obsColor:   null,
      isFuture:   true,
    }));

  return [...past, ...future];
}

// ── X-tick: day name at midnight, "12:00" at noon ─────────────────
function XTick({ x, y, payload, tickMeta }) {
  const meta = tickMeta?.get(payload?.value);
  if (!meta) return null;
  if (meta.isNoon) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={13} textAnchor="middle" fill="#2a4060" fontSize={9}>12:00</text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={11} textAnchor="middle" fill="#5a7a99" fontSize={10} fontWeight={700}>
        {meta.dayLabel}
      </text>
      <text x={0} y={23} textAnchor="middle" fill="#2a4060" fontSize={9}>
        00:00
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
        {new Date(d.time).toLocaleString('en-GB', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
        })}
      </div>
      {d.modelSpeed != null && (
        <div style={{ fontSize: 10, color: '#4d8fff', marginBottom: 2 }}>
          AROME: <span className="font-num" style={{ fontWeight: 700 }}>
            {Math.round(d.modelSpeed)} kn
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
export default function ModelAccuracyChart({ data = [], observations = [], loading = false }) {
  const allStats = useMemo(() => computeAllStats(observations), [observations]);
  const reliability = reliabilityLabel(allStats?.mae ?? Infinity, allStats?.n ?? 0);

  const chartData = useMemo(
    () => buildChartData(observations, data),
    [observations, data]
  );

  const hasObs  = chartData.some(d => d.obsSpeed != null);
  const lastPast = chartData.filter(d => !d.isFuture).at(-1)?.time ?? null;

  // Ticks: one entry per day at Rome midnight (00:00) and Rome noon (12:00)
  // We pick entries where UTC minutes === 0 and Rome hour === 0 or 12.
  const { ticks, tickMeta, midnightTimes } = useMemo(() => {
    const ticks = [];
    const tickMeta = new Map();
    const midnightTimes = [];
    const seenSlot = new Set();

    for (const entry of chartData) {
      const ms  = new Date(entry.time).getTime();
      const min = new Date(entry.time).getUTCMinutes();
      if (min !== 0) continue; // only on-the-hour entries

      const h       = getRomeHour(entry.time);
      const dayKey  = entry.time.substring(0, 10);
      const slotKey = dayKey + '-' + h;
      if (seenSlot.has(slotKey)) continue;

      if (h === 0) {
        seenSlot.add(slotKey);
        ticks.push(entry.time);
        tickMeta.set(entry.time, {
          isNoon:   false,
          dayLabel: getDayName(entry.time),
        });
        midnightTimes.push(entry.time);
      } else if (h === 12) {
        seenSlot.add(slotKey);
        ticks.push(entry.time);
        tickMeta.set(entry.time, { isNoon: true });
      }
    }

    return { ticks, tickMeta, midnightTimes };
  }, [chartData]);

  if (!chartData.length) return null;

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

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />

          {/* Day separator lines at each Rome midnight */}
          {midnightTimes.map(t => (
            <ReferenceLine
              key={'day-' + t}
              x={t}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
            />
          ))}

          {/* "now" dashed line */}
          {lastPast && (
            <ReferenceLine
              x={lastPast}
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
            tick={<XTick tickMeta={tickMeta} />}
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
            <linearGradient id="accModelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4d8fff" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#4d8fff" stopOpacity={0}    />
            </linearGradient>
          </defs>

          {/* AROME model line + fill */}
          <Area
            type="monotone" dataKey="modelSpeed"
            stroke="#4d8fff" strokeWidth={1.5}
            fill="url(#accModelGrad)" dot={false}
            isAnimationActive={false} connectNulls
          />

          {/* Observed dots coloured by error magnitude */}
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
                    cx={cx} cy={cy} r={3}
                    fill={col} stroke="#0a1e2a" strokeWidth={1}
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
          AROME forecast
        </span>
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
            ? `No observations in the last ${WINDOW_DAYS}-day window.`
            : 'Observation history will appear once data is logged for this station.'}
        </div>
      )}
    </div>
  );
}
