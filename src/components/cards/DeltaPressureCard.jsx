import {
  AreaChart, Area, ResponsiveContainer,
  ReferenceLine, XAxis, YAxis,
} from 'recharts';
import { getDpInterpretation } from '../../utils/windPhysics.js';
import { formatTime } from '../../utils/formatters.js';

/**
 * Bolzano–Ghedi ΔP card
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │  ΔP Bolzano − Ghedi           [regime badge] │
 *   │  ─────────────────────────────────────────── │
 *   │  −3.2        │  ↑ Ora                        │
 *   │  hPa         │   ──────────────────           │
 *   │              │  ── zero ─── · now            │
 *   │  description │  ──────────────────           │
 *   │  est. ~18 kn │  ↓ Pelér                      │
 *   │              │  10:00  14:00  18:00           │
 *   └──────────────────────────────────────────────┘
 *
 * Props: { dp, hourly, regime }
 */
export default function DeltaPressureCard({ dp, hourly, regime }) {
  const interp  = getDpInterpretation(dp);
  const isPeler = regime === 'pelér';
  const isOra   = regime === 'ora';
  const color   = isPeler ? 'var(--peler)' : isOra ? 'var(--ora)' : 'var(--text-2)';
  const hex     = isPeler ? '#5090ff' : isOra ? '#f5a428' : '#6a8099';

  const sign  = dp !== null ? (dp >= 0 ? '+' : '\u2212') : '';
  const dpAbs = dp !== null ? Math.abs(dp).toFixed(1) : null;

  // ── Sparkline: −6h → +18h window ────────────────────────────
  const sparkData = (hourly ?? [])
    .filter(h => h.dp !== null && h.diffH >= -6 && h.diffH <= 18)
    .map(h => ({ dp: h.dp, diffH: h.diffH, time: h.time, isNow: h.isNow }));

  // Y domain symmetric, always showing ±1.5 thresholds
  const allDps = sparkData.map(d => d.dp);
  const maxAbs = Math.max(3, ...allDps.map(v => Math.abs(v)));
  const yDomain = [-(maxAbs + 0.5), maxAbs + 0.5];

  // Build x-axis tick labels at 0h, +6h, +12h, +18h from now
  const now = new Date();
  const xTicks = [0, 6, 12, 18];
  const xTickLabels = {};
  xTicks.forEach(dh => {
    const d = new Date(now.getTime() + dh * 3600 * 1000);
    xTickLabels[dh] = dh === 0 ? 'now' : formatTime(d.toISOString());
  });

  const gradId = `dpGrad-${regime}`;

  return (
    <div
      className={`card fade-up ${isPeler ? 'card-peler' : isOra ? 'card-ora' : ''}`}
      style={{ padding: '10px 14px 8px' }}
    >

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}>
        <div className="label-xs">ΔP Bolzano − Ghedi</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 6,
          background: `${hex}14`, border: `1px solid ${hex}30`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: hex, boxShadow: `0 0 5px ${hex}88`, flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color, fontWeight: 600 }}>
            {isPeler ? 'Pelér' : isOra ? 'Ora' : 'Variable'}
          </span>
        </div>
      </div>

      {/* ── Main row: value left, chart right ──────────────── */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>

        {/* Left — ΔP number + description */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: '0 0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span
              className="font-num"
              style={{ fontSize: 'clamp(28px, 7vw, 42px)', fontWeight: 700, color, lineHeight: 1 }}
            >
              {dp !== null ? `${sign}${dpAbs}` : '—'}
            </span>
            {dp !== null && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>hPa</span>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 5, lineHeight: 1.35, maxWidth: 120 }}>
            {interp.description}
          </div>

          {interp.estimatedKnots && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
              {'Est. '}
              <span className="font-num" style={{ color, fontWeight: 600 }}>
                ~{interp.estimatedKnots} kn
              </span>
            </div>
          )}
        </div>

        {/* Right — sparkline with ↑Ora / ↓Pelér overlays + time x-axis */}
        {sparkData.length > 3 && (
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            {/* ↑ Ora label — top of chart */}
            <div style={{
              position: 'absolute', top: 0, right: 0,
              fontSize: 9, fontWeight: 700, color: '#f5a42880',
              letterSpacing: '0.04em', lineHeight: 1, pointerEvents: 'none',
              zIndex: 1,
            }}>
              ↑ Ora
            </div>

            {/* ↓ Pelér label — bottom of chart (above x-axis labels) */}
            <div style={{
              position: 'absolute', bottom: 18, right: 0,
              fontSize: 9, fontWeight: 700, color: '#5090ff80',
              letterSpacing: '0.04em', lineHeight: 1, pointerEvents: 'none',
              zIndex: 1,
            }}>
              ↓ Pelér
            </div>

            <ResponsiveContainer width="100%" height={116}>
              <AreaChart
                data={sparkData}
                margin={{ top: 10, right: 2, left: 2, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor={hex} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={hex} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="diffH"
                  type="number"
                  domain={[-6, 18]}
                  ticks={xTicks}
                  tickFormatter={dh => xTickLabels[dh] ?? ''}
                  tick={{ fontSize: 8, fill: 'var(--text-3)', fontFamily: 'var(--font-num)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />

                <YAxis domain={yDomain} hide />

                {/* Zero line — the key reference */}
                <ReferenceLine
                  y={0}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={1.5}
                />

                {/* Pelér threshold */}
                <ReferenceLine
                  y={-1.5}
                  stroke="#5090ff"
                  strokeWidth={1}
                  strokeOpacity={0.2}
                  strokeDasharray="3 3"
                />

                {/* Ora threshold */}
                <ReferenceLine
                  y={1.5}
                  stroke="#f5a428"
                  strokeWidth={1}
                  strokeOpacity={0.2}
                  strokeDasharray="3 3"
                />

                {/* "Now" vertical */}
                <ReferenceLine
                  x={0}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />

                <Area
                  type="monotone"
                  dataKey="dp"
                  stroke={hex}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
