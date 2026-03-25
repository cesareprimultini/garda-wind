/**
 * Display formatters for the GardaWind app.
 * Always use Europe/Rome timezone for Garda-local display.
 */

const ROME_TZ = 'Europe/Rome';

/**
 * Format ISO string as HH:mm in Europe/Rome timezone
 * @param {string} isoString
 * @returns {string} e.g. "14:30"
 */
export function formatTime(isoString) {
  if (!isoString) return '--:--';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: ROME_TZ,
    }).format(new Date(isoString));
  } catch {
    return '--:--';
  }
}

/**
 * Format ISO string as "Mon 24 Mar" in Europe/Rome timezone
 * @param {string} isoString
 * @returns {string}
 */
export function formatDate(isoString) {
  if (!isoString) return '---';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: ROME_TZ,
    }).format(new Date(isoString));
  } catch {
    return '---';
  }
}

/**
 * Format knots with unit
 * @param {number|null} kn
 * @returns {string} e.g. "23 kn"
 */
export function formatKnots(kn) {
  if (kn === null || kn === undefined) return '— kn';
  return `${Math.round(kn)} kn`;
}

/**
 * Format pressure in hPa
 * @param {number|null} hpa
 * @returns {string} e.g. "1013.2 hPa"
 */
export function formatHPa(hpa) {
  if (hpa === null || hpa === undefined) return '— hPa';
  return `${Number(hpa).toFixed(1)} hPa`;
}

/**
 * Format ΔP with proper minus sign (not hyphen)
 * @param {number|null} dp
 * @returns {string} e.g. "−2.8 hPa" or "+2.4 hPa"
 */
export function formatDp(dp) {
  if (dp === null || dp === undefined) return '— hPa';
  const sign = dp >= 0 ? '+' : '\u2212'; // proper minus sign
  return `${sign}${Math.abs(dp).toFixed(1)} hPa`;
}

/**
 * Format a Date or ISO string as "X min ago" or "X hr ago"
 * @param {Date|string} date
 * @returns {string}
 */
export function timeAgo(date) {
  if (!date) return 'never';
  try {
    const now = Date.now();
    const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    return `${Math.floor(diffHr / 24)} d ago`;
  } catch {
    return '—';
  }
}

/**
 * Get hour in Europe/Rome as a number (0-23)
 * @param {string} isoString
 * @returns {number}
 */
export function getRomeHour(isoString) {
  if (!isoString) return 0;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: ROME_TZ,
    }).formatToParts(new Date(isoString));
    const h = parts.find(p => p.type === 'hour');
    return h ? parseInt(h.value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Get short day name in Europe/Rome
 * @param {string} isoString
 * @returns {string} e.g. "Mon"
 */
export function getDayName(isoString) {
  if (!isoString) return '---';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      timeZone: ROME_TZ,
    }).format(new Date(isoString));
  } catch {
    return '---';
  }
}
