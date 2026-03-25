import { useEffect, useState } from 'react';
import { timeAgo } from '../../utils/formatters.js';

/**
 * Color-coded freshness dot + "Updated X min ago" text
 * Props: { lastUpdated: Date|null, isRefreshing: boolean, onClick: fn }
 */
export default function RefreshIndicator({ lastUpdated, isRefreshing, onClick }) {
  // Tick every 30s to keep the "X min ago" display live
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const ageMin = lastUpdated ? (Date.now() - lastUpdated.getTime()) / 60000 : Infinity;
  let dotColor = '#324158';
  if (lastUpdated) {
    if (ageMin < 5)       dotColor = '#0dcfa8';
    else if (ageMin < 20) dotColor = '#f5a428';
    else                  dotColor = '#f43f5e';
  }

  return (
    <button
      onClick={onClick}
      title="Tap to refresh"
      aria-label="Refresh weather data"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 8px',
        borderRadius: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-2)',
        fontSize: 11,
        transition: 'background 0.15s',
      }}
    >
      <span
        className={isRefreshing ? 'pulse-dot' : ''}
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: isRefreshing ? '#5090ff' : dotColor,
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: isRefreshing ? '0 0 6px #5090ff88' : 'none',
        }}
      />
      <span>
        {isRefreshing
          ? 'Updating…'
          : lastUpdated
            ? `${timeAgo(lastUpdated)}`
            : 'No data'}
      </span>
    </button>
  );
}
