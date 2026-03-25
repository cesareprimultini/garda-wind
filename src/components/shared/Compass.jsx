import { degreesToCompass } from '../../utils/windPhysics.js';

/**
 * SVG compass rose with animated needle
 * Props: { degrees: number, size: number, color: string }
 */
export default function Compass({ degrees = 0, size = 80, color = '#4d8fff' }) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const innerR = r * 0.65;
  const tickR = r * 0.88;
  const labelR = r * 0.75;

  const cardinalLabels = [
    { label: 'N', angle: 0 },
    { label: 'E', angle: 90 },
    { label: 'S', angle: 180 },
    { label: 'W', angle: 270 },
  ];

  const toXY = (angle, radius) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  // Tick marks (every 45°)
  const ticks = [0, 45, 90, 135, 180, 225, 270, 315];

  // Needle: points "from" direction (wind comes FROM this direction)
  // Arrow tip points toward where wind is blowing
  const needleLength = innerR * 0.75;
  const tipAngle = degrees; // wind direction = direction it comes FROM
  const tip = toXY(tipAngle, needleLength);
  const tail = toXY(tipAngle + 180, needleLength * 0.45);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Wind direction: ${degreesToCompass(degrees)} ${Math.round(degrees)}°`}
    >
      {/* Outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 2}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1.5}
      />
      {/* Inner circle background */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        fill="rgba(8,13,20,0.6)"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={1}
      />

      {/* Tick marks */}
      {ticks.map(angle => {
        const outer = toXY(angle, r - 4);
        const inner = toXY(angle, r - 9);
        return (
          <line
            key={angle}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
          />
        );
      })}

      {/* Cardinal labels */}
      {cardinalLabels.map(({ label, angle }) => {
        const pos = toXY(angle, labelR);
        const isNorth = label === 'N';
        return (
          <text
            key={label}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={size * 0.115}
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight={isNorth ? '700' : '500'}
            fill={isNorth ? color : 'rgba(255,255,255,0.45)'}
          >
            {label}
          </text>
        );
      })}

      {/* Animated needle group */}
      <g
        className="compass-needle"
        style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(0deg)` }}
      >
        <g style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `rotate(${degrees}deg)`,
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {/* Needle body */}
          <line
            x1={cx}
            y1={cy}
            x2={toXY(0, needleLength).x}
            y2={toXY(0, needleLength).y}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Tail (opposite) */}
          <line
            x1={cx}
            y1={cy}
            x2={toXY(180, needleLength * 0.45).x}
            y2={toXY(180, needleLength * 0.45).y}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Arrowhead */}
          <polygon
            points={`
              ${toXY(0, needleLength).x},${toXY(0, needleLength).y}
              ${toXY(-18, needleLength * 0.72).x},${toXY(-18, needleLength * 0.72).y}
              ${toXY(18, needleLength * 0.72).x},${toXY(18, needleLength * 0.72).y}
            `}
            fill={color}
          />
        </g>
      </g>

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.8)" />
    </svg>
  );
}
