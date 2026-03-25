import {
  getKiteSize,
  getKiteFoilSize,
  getWindsurfSail,
  getWingSize,
  getSportStatus,
} from '../../utils/windPhysics.js';
import { QUALITY_COLORS } from '../../utils/constants.js';

const STATUS_COLOR = {
  'go':          '#0dcfa8',
  'marginal':    '#38bdf8',
  'overpowered': '#f43f5e',
  'no-go':       '#324158',
};

const STATUS_LABEL = {
  'go':          'Go',
  'marginal':    'Marginal',
  'overpowered': 'Too strong',
  'no-go':       'No wind',
};

function boardForKite(windSpeed) {
  if (!windSpeed || windSpeed < 10) return null;
  if (windSpeed > 24) return 'Directional';
  return 'Twin tip';
}

function boardForWindsurf(windSpeed) {
  if (!windSpeed || windSpeed < 10) return null;
  if (windSpeed > 25) return 'Wave / slalom';
  if (windSpeed > 18) return 'Freeride short';
  return 'Freeride';
}

function noteForFoil(windSpeed) {
  if (!windSpeed || windSpeed < 7) return 'Needs 7 kn+';
  if (windSpeed < 10) return 'Pumping start';
  if (windSpeed < 18) return 'Foil cruising';
  return 'Powered up';
}

function noteForWing(windSpeed) {
  if (!windSpeed || windSpeed < 10) return 'Needs 10 kn+';
  if (windSpeed < 14) return 'Pump to foil';
  if (windSpeed < 20) return 'Cruising';
  return 'Powered';
}

/** Single sport gear card */
function SportCard({ sport, label, emoji, primary, secondary, note, status }) {
  const col = STATUS_COLOR[status] ?? STATUS_COLOR['no-go'];
  const isGo = status === 'go' || status === 'marginal';

  return (
    <div
      className="card fade-up"
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        borderTop: `2px solid ${col}22`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Status stripe on left edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: col,
          borderRadius: '4px 0 0 4px',
        }}
      />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13 }}>{emoji}</span>
          <span className="label-xs">{label}</span>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: col,
            padding: '2px 6px',
            borderRadius: 4,
            background: `${col}18`,
          }}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Primary gear size */}
      <div
        className="font-num"
        style={{
          fontSize: 'clamp(16px, 3.8vw, 22px)',
          fontWeight: 700,
          color: isGo ? col : 'var(--text-3)',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {primary || '—'}
      </div>

      {/* Secondary line */}
      {secondary && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3, fontWeight: 500 }}>
          {secondary}
        </div>
      )}

      {/* Note */}
      {note && (
        <div style={{ fontSize: 10, color: isGo ? `${col}aa` : 'var(--text-3)', marginTop: 'auto', paddingTop: 4 }}>
          {note}
        </div>
      )}
    </div>
  );
}

/**
 * 2×2 grid of sport-specific gear cards.
 * Props: { windSpeed }
 */
export default function SportGearGrid({ windSpeed }) {
  const kiteStatus  = getSportStatus('kite',     windSpeed);
  const foilStatus  = getSportStatus('foil',     windSpeed);
  const wsStatus    = getSportStatus('windsurf', windSpeed);
  const wingStatus  = getSportStatus('wing',     windSpeed);

  const kiteSize  = getKiteSize(windSpeed);
  const foilSize  = getKiteFoilSize(windSpeed);
  const sailSize  = getWindsurfSail(windSpeed);
  const wingSize  = getWingSize(windSpeed);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}
    >
      <SportCard
        sport="kite"
        label="Kitesurf"
        emoji="🪁"
        primary={kiteSize.trim() !== '—' ? kiteSize : null}
        secondary={boardForKite(windSpeed)}
        note={windSpeed >= 10 ? `Gusts: stay detuned` : 'Needs 10 kn+'}
        status={kiteStatus}
      />
      <SportCard
        sport="foil"
        label="Kite Foil"
        emoji="🏄"
        primary={foilSize !== '—' ? foilSize : null}
        secondary={foilSize !== '—' ? 'Foil kite' : null}
        note={noteForFoil(windSpeed)}
        status={foilStatus}
      />
      <SportCard
        sport="windsurf"
        label="Windsurf"
        emoji="🌊"
        primary={sailSize.trim() !== '—' ? sailSize : null}
        secondary={boardForWindsurf(windSpeed)}
        note={windSpeed >= 10 ? 'Fin: 36–48cm' : 'Needs 10 kn+'}
        status={wsStatus}
      />
      <SportCard
        sport="wing"
        label="Wing Foil"
        emoji="🦅"
        primary={wingSize !== '—' ? wingSize : null}
        secondary={wingSize !== '—' ? 'Foil board' : null}
        note={noteForWing(windSpeed)}
        status={wingStatus}
      />
    </div>
  );
}
