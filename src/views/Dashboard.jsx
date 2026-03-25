import HeroWindCard from '../components/cards/HeroWindCard.jsx';
import DeltaPressureCard from '../components/cards/DeltaPressureCard.jsx';
import SportGearGrid from '../components/cards/SportGearGrid.jsx';
import HourlyTimeline from '../components/forecast/HourlyTimeline.jsx';
import { detectRegime, getQuality, getKiteSize } from '../utils/windPhysics.js';

// ─── tiny section header ─────────────────────────────────────────
function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px' }}>
      <span className="section-label">{children}</span>
      {right && <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>{right}</span>}
    </div>
  );
}

// ─── 2×2 mini stat grid ──────────────────────────────────────────
function MiniStat({ label, value, unit, color, accent }) {
  return (
    <div
      className="card"
      style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        borderLeft: accent ? `2px solid ${accent}` : undefined,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span
          className="font-num"
          style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 700, color: color || 'var(--text-1)', lineHeight: 1 }}
        >
          {value !== null && value !== undefined ? value : '—'}
        </span>
        {unit && (
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── skeleton ────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div className="skeleton" style={{ height: 16, width: 80 }} />
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 16, width: 60 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8 }}>
        <div className="skeleton" style={{ height: 130 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div className="skeleton" style={{ height: 60 }} />
          <div className="skeleton" style={{ height: 60 }} />
          <div className="skeleton" style={{ height: 60 }} />
          <div className="skeleton" style={{ height: 60 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 16, width: 80 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 90 }} />
      </div>
      <div className="skeleton" style={{ height: 16, width: 80 }} />
      <div className="skeleton" style={{ flex: 1 }} />
    </div>
  );
}

/**
 * Main dashboard panel
 *
 * Layout:
 *   LAKE GARDA — ΔP card
 *   STATION    — Hero card | 2×2 mini stats (Pressure, Temp, Cloud, Gusts)
 *   GEAR       — 2×2 sport cards (Kitesurf, Kite Foil, Windsurf, Wing Foil)
 *   TODAY      — Hourly timeline
 */
export default function Dashboard({ data, loading, error, stationId }) {
  if (loading && !data) return <DashboardSkeleton />;

  if (error && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
        <div className="card" style={{ padding: '24px', textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
            Unable to load data
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{error}</div>
        </div>
      </div>
    );
  }

  const current  = data?.current;
  const hourly   = data?.hourly ?? [];
  const dp       = data?.currentDp ?? null;

  const nowEntry = hourly.find(h => h.isNow) ?? hourly[0];
  const cloud    = nowEntry?.cloud ?? null;

  // ── Live observed data (per-station) ──────────────────────────
  // Priority: Lega Navale (Bardolino only) > MeteoNetwork interpolated > model
  const mnObs = data?.observed?.meteoNetwork?.[stationId] ?? null;
  const LIVE_SOURCES = {
    bardolino:  data?.observed?.bardolinoWind ?? mnObs,
    leganavale: data?.observed?.bardolinoWind ?? mnObs,
  };
  const liveWind  = LIVE_SOURCES[stationId] ?? mnObs;
  const isLive    = liveWind !== null;
  const liveLabel = liveWind?.source ?? null;

  // Prefer live observed values; fall back to model current
  const windSpeed = liveWind?.speedKn  ?? current?.windSpeed ?? null;
  const windGusts = liveWind?.gustKn   ?? current?.windGusts ?? null;
  const windDir   = liveWind?.dir      ?? current?.windDir   ?? null;
  const isLegaNavale = stationId === 'bardolino' || stationId === 'leganavale';
  const liveMslp  = (isLegaNavale ? data?.observed?.bardolinoMslp : null) ?? mnObs?.mslp ?? null;
  const pressure  = (isLive ? liveMslp : null) ?? current?.pressure ?? null;
  const temp      = liveWind?.temp     ?? current?.temp      ?? null;

  // Recompute quality/regime/kite from live speed when available
  const regime        = isLive ? detectRegime(dp, windDir)  : (data?.currentRegime  ?? 'variable');
  const quality       = isLive ? getQuality(windSpeed)      : (data?.currentQuality ?? 'none');
  const kiteSizeLabel = isLive ? getKiteSize(windSpeed)     : (data?.currentKiteSize ?? '—');

  // Compose a current-shaped object for child components
  const currentDisplay = { windSpeed, windGusts, windDir, pressure, temp };

  // Colour hints for mini stats
  const pressureColor = pressure !== null
    ? (pressure > 1020 ? '#0dcfa8' : pressure < 1005 ? '#5090ff' : 'var(--text-1)')
    : undefined;
  const tempColor = temp !== null
    ? (temp > 28 ? '#f5a428' : temp < 3 ? '#5090ff' : 'var(--text-1)')
    : undefined;
  const cloudColor = cloud !== null && cloud > 80 ? '#6a8099' : 'var(--text-1)';
  const gustsColor = windGusts !== null && windGusts > 25 ? '#f43f5e' : 'var(--text-1)';

  return (
    <div
      className="panel-full"
      style={{ overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px 4px', gap: 0 }}
    >
      {/* ── Offline banner ─────────────────────────────── */}
      {error && data && (
        <div
          style={{
            marginBottom: 8,
            padding: '7px 12px',
            borderRadius: 10,
            background: 'rgba(245,164,40,0.08)',
            border: '1px solid rgba(245,164,40,0.2)',
            color: '#f5c46a',
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 1 — LAKE CONDITIONS (ΔP global)            */}
      {/* ═══════════════════════════════════════════════════ */}
      <SectionLabel right="Bolzano − Ghedi">Lake Garda</SectionLabel>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <DeltaPressureCard dp={dp} hourly={hourly} regime={regime} />
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 2 — STATION: Hero + 2×2 mini stat grid     */}
      {/* ═══════════════════════════════════════════════════ */}
      <SectionLabel right={
        isLive
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                background: '#0dcfa820', border: '1px solid #0dcfa840',
                color: '#0dcfa8', borderRadius: 4, padding: '1px 5px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              }}>LIVE</span>
              <span>{liveLabel}</span>
            </span>
          : 'model data'
      }>Station</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginTop: 6,
          marginBottom: 14,
          alignItems: 'stretch',
        }}
      >
        <HeroWindCard
          current={currentDisplay}
          regime={regime}
          quality={quality}
          kiteSizeLabel={kiteSizeLabel}
        />

        {/* 2×2 mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <MiniStat
            label="Press."
            value={pressure !== null ? pressure.toFixed(0) : null}
            unit="hPa"
            color={pressureColor}
            accent={pressureColor !== 'var(--text-1)' ? pressureColor : undefined}
          />
          <MiniStat
            label="Temp"
            value={temp !== null ? Math.round(temp) : null}
            unit="°C"
            color={tempColor}
          />
          <MiniStat
            label="Cloud"
            value={cloud !== null ? Math.round(cloud) : null}
            unit="%"
            color={cloudColor}
          />
          <MiniStat
            label="Gusts"
            value={windGusts !== null ? Math.round(windGusts) : null}
            unit="kn"
            color={gustsColor}
            accent={windGusts > 25 ? '#f43f5e' : undefined}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 3 — GEAR (4 sport cards)                   */}
      {/* ═══════════════════════════════════════════════════ */}
      <SectionLabel right="size recommendations">Gear</SectionLabel>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <SportGearGrid windSpeed={windSpeed} />
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 4 — TODAY'S FORECAST                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <SectionLabel right="next 36h · 06–22">Today</SectionLabel>
      <div
        className="card"
        style={{ marginTop: 6, padding: '10px 8px', marginBottom: 8 }}
      >
        <HourlyTimeline data={hourly} />
      </div>

      <div style={{ height: 4, flexShrink: 0 }} />
    </div>
  );
}
