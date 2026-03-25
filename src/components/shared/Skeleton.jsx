/**
 * Shimmer skeleton loader component
 */
export default function Skeleton({ className = '', height, width, rounded = 'rounded-lg' }) {
  const style = {};
  if (height) style.height = height;
  if (width) style.width = width;

  return (
    <div
      className={`skeleton ${rounded} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton block for a card
 */
export function CardSkeleton({ className = '' }) {
  return (
    <div
      className={`card p-4 flex flex-col gap-3 ${className}`}
      aria-hidden="true"
    >
      <Skeleton height="14px" width="40%" />
      <Skeleton height="48px" width="70%" />
      <Skeleton height="12px" width="55%" />
    </div>
  );
}

/**
 * Skeleton block for a chart
 */
export function ChartSkeleton({ height = 200, className = '' }) {
  return (
    <div
      className={`card p-4 ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <Skeleton height="12px" width="30%" className="mb-4" />
      <Skeleton height={height - 60} rounded="rounded-md" />
    </div>
  );
}
