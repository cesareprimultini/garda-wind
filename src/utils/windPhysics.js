/**
 * Wind physics and meteorological interpretation for Lake Garda
 *
 * Primary ΔP: Bolzano (46.50°N, 265m) − Ghedi (45.41°N, 66m)
 * Both values are MSLP (altitude-corrected), so elevation difference is irrelevant.
 * Negative ΔP → Pelér (N→S katabatic/synoptic fall wind)
 * Positive ΔP → Ora (S→N lake thermal breeze)
 *
 * Scientific basis:
 * - Bolzano–Ghedi pair validated by profiwetter.ch and regional practitioners.
 *   130km N–S separation captures the synoptic gradient driving both regimes.
 * - ±1.5 hPa threshold is empirically well-established across multiple sources.
 * - ΔP ≈ −3 hPa → ~20 kn Pelér is the most consistently cited calibration point.
 * - Ora is a thermally driven lake breeze — physically impossible before ~10:00 local,
 *   always peaks 13:00–17:00. Time-of-day strongly modulates regime confidence.
 * - Pelér is dominant 04:00–11:00, driven by overnight Alpine pressure build.
 * - Wind direction at Garda funnels tightly: Pelér 340–020°, Ora 155–195°
 *   (lake N–S axis 350°–170°). Broader sectors indicate non-Garda-regime wind.
 * - Rate of change (dΔP/dt) is as important as absolute value:
 *   building gradient is more reliable than a collapsing one at the same level.
 */

const TWO_PI = 2 * Math.PI;
const DEG = Math.PI / 180;

/** Normalise degrees to [0, 360) */
function normDeg(d) { return ((d % 360) + 360) % 360; }

/**
 * Detect wind regime from ΔP, optional wind direction, and optional local hour.
 *
 * Improvements over naïve threshold:
 *  1. Narrowed wind-direction fallback windows (340–020° Pelér, 155–195° Ora)
 *     to match the lake's N–S valley funnel geometry.
 *  2. Time-of-day guard: Ora requires hour ≥ 10 (thermal can't build before then);
 *     Pelér is suppressed after 18:00 if ΔP is only marginal (−1.5 to −2.5).
 *
 * @param {number|null} dp       - Bolzano − Ghedi pressure differential (hPa)
 * @param {number|null} windDir  - Wind direction in degrees (0–360)
 * @param {number|null} localHour - Local hour 0–23, or null if unknown
 * @returns {'pelér'|'ora'|'variable'}
 */
export function detectRegime(dp, windDir = null, localHour = null) {
  if (dp !== null && dp !== undefined) {
    // Strong signals — time-of-day cannot override a clear gradient
    if (dp < -2.5) return 'pelér';
    if (dp > 2.5)  return 'ora';

    // Marginal Pelér: suppress after 18:00 local (gradient fading with afternoon heating)
    if (dp < -1.5) {
      if (localHour !== null && localHour >= 18) return 'variable';
      return 'pelér';
    }

    // Marginal Ora: require hour ≥ 10 local (thermal lake breeze cannot build earlier)
    if (dp > 1.5) {
      if (localHour !== null && localHour < 10) return 'variable';
      return 'ora';
    }
  }

  // ΔP ambiguous (|ΔP| ≤ 1.5) — fall back to wind direction with tighter windows
  if (windDir !== null && windDir !== undefined) {
    const dir = normDeg(windDir);
    // Pelér: 340–020° (tight N corridor along lake axis)
    if (dir >= 340 || dir <= 20) return 'pelér';
    // Ora: 155–195° (tight S corridor)
    if (dir >= 155 && dir <= 195) return 'ora';
  }

  return 'variable';
}

/**
 * Compute the rate of change of ΔP in hPa/hour from two readings.
 * Positive = gradient building toward Ora; negative = building toward Pelér.
 *
 * @param {number} dpNow      - Current ΔP (hPa)
 * @param {number} dpPrev     - Previous ΔP (hPa), from ~15–60 min ago
 * @param {number} intervalMin - Minutes between the two readings
 * @returns {number} dΔP/dt in hPa/hour
 */
export function computeDpTrend(dpNow, dpPrev, intervalMin = 60) {
  return ((dpNow - dpPrev) / intervalMin) * 60;
}

/**
 * Get regime confidence modifier based on time of day and ΔP trend.
 * Returns a qualitative adjustment: 'boosted' | 'normal' | 'reduced'
 *
 * @param {'pelér'|'ora'|'variable'} regime
 * @param {number|null} localHour
 * @param {number|null} dpTrend  - dΔP/dt in hPa/h (positive = growing Ora)
 */
export function getRegimeConfidenceModifier(regime, localHour, dpTrend = null) {
  if (regime === 'ora') {
    // Ora peak window 13–17, building 10–13
    const inPeak = localHour !== null && localHour >= 13 && localHour <= 17;
    const building = dpTrend !== null && dpTrend > 0.3;
    if (inPeak || building) return 'boosted';
    if (localHour !== null && (localHour < 10 || localHour > 19)) return 'reduced';
  }
  if (regime === 'pelér') {
    // Pelér peak window 05–10
    const inPeak = localHour !== null && localHour >= 5 && localHour <= 10;
    const building = dpTrend !== null && dpTrend < -0.3;
    if (inPeak || building) return 'boosted';
    if (localHour !== null && localHour >= 16) return 'reduced';
  }
  return 'normal';
}

/**
 * Get session quality label from wind speed in knots.
 * @param {number} windSpeed - Wind speed in knots
 * @returns {'none'|'marginal'|'good'|'advanced'|'storm'}
 */
export function getQuality(windSpeed) {
  if (!windSpeed || windSpeed < 8) return 'none';
  if (windSpeed < 12) return 'marginal';
  if (windSpeed < 22) return 'good';
  if (windSpeed < 32) return 'advanced';
  return 'storm';
}

/**
 * Get recommended kite size from wind speed in knots.
 * @param {number} windSpeed
 * @returns {string}
 */
export function getKiteSize(windSpeed) {
  if (!windSpeed || windSpeed < 8) return '— ';
  if (windSpeed < 10) return '17–19m';
  if (windSpeed < 13) return '14–16m';
  if (windSpeed < 17) return '12–14m';
  if (windSpeed < 21) return '10–12m';
  if (windSpeed < 26) return '9–10m';
  if (windSpeed < 31) return '7–9m';
  if (windSpeed < 38) return '5–7m';
  return '< 5m / No Go';
}

/**
 * Get recommended windsurf sail size from wind speed in knots.
 * @param {number} windSpeed
 * @returns {string}
 */
export function getWindsurfSail(windSpeed) {
  if (!windSpeed || windSpeed < 8) return '— ';
  if (windSpeed < 11) return '8.0–9.0m²';
  if (windSpeed < 14) return '6.5–8.0m²';
  if (windSpeed < 18) return '5.5–6.5m²';
  if (windSpeed < 22) return '4.7–5.5m²';
  if (windSpeed < 28) return '4.0–4.7m²';
  if (windSpeed < 35) return '3.5–4.0m²';
  return '< 3.5m² / No Go';
}

/**
 * Get recommended wing size for wing foiling from wind speed in knots.
 * @param {number} windSpeed
 * @returns {string}
 */
export function getWingSize(windSpeed) {
  if (!windSpeed || windSpeed < 10) return '—';
  if (windSpeed < 14) return '6–7m';
  if (windSpeed < 18) return '5–6m';
  if (windSpeed < 22) return '4–5m';
  if (windSpeed < 28) return '3–4m';
  return '< 3m';
}

/**
 * Get recommended kite size for kite foiling from wind speed in knots.
 * Foil kites work at lower wind than twin-tip kites.
 * @param {number} windSpeed
 * @returns {string}
 */
export function getKiteFoilSize(windSpeed) {
  if (!windSpeed || windSpeed < 7) return '—';
  if (windSpeed < 10) return '15–17m';
  if (windSpeed < 13) return '13–15m';
  if (windSpeed < 17) return '11–13m';
  if (windSpeed < 22) return '9–11m';
  if (windSpeed < 28) return '7–9m';
  return '< 7m';
}

/**
 * Get session status for a sport at a given wind speed.
 * @param {'kite'|'foil'|'windsurf'|'wing'} sport
 * @param {number} windSpeed
 * @returns {'no-go'|'marginal'|'go'|'overpowered'}
 */
export function getSportStatus(sport, windSpeed) {
  if (!windSpeed) return 'no-go';
  const ranges = {
    kite:     { min: 10, max: 35 },
    foil:     { min: 7,  max: 28 },
    windsurf: { min: 10, max: 40 },
    wing:     { min: 10, max: 30 },
  };
  const r = ranges[sport];
  if (!r) return 'no-go';
  if (windSpeed < r.min) return 'no-go';
  if (windSpeed > r.max) return 'overpowered';
  if (windSpeed < r.min + 3) return 'marginal';
  return 'go';
}

/**
 * Estimate wind speed from ΔP using the empirically validated Garda calibration.
 *
 * Key calibration points (profiwetter.ch + local practice):
 *   Pelér: ΔP = −3 hPa → ~20 kn  (most cited reference point)
 *          ΔP = −5 hPa → ~28–30 kn
 *          ΔP = −1.5 hPa → onset ~10 kn
 *   Ora:   ΔP = +3 hPa → ~16–18 kn (thermal winds less predictable from pressure alone)
 *          ΔP = +1.5 hPa → onset ~8 kn
 *
 * The relationship is non-linear: beyond ±3 hPa, small changes drive large wind increases
 * because the pressure gradient accelerates airflow through the narrow Alpine valley.
 *
 * Ora estimates carry lower confidence than Pelér — thermal lake breezes depend on
 * solar heating and humidity, not just pressure gradient.
 *
 * @param {number|null} dp
 * @param {number|null} dpTrend - dΔP/dt in hPa/h (optional, for trend annotation)
 * @param {number|null} localHour
 * @returns {{ regime, estimatedKnots, description, confidence, trend }}
 */
export function getDpInterpretation(dp, dpTrend = null, localHour = null) {
  const trend = dpTrend !== null
    ? Math.abs(dpTrend) > 0.5
      ? (dpTrend < 0 ? '↓ building Pelér' : '↑ building Ora')
      : Math.abs(dpTrend) > 0.2
      ? (dpTrend < 0 ? '↓ trending Pelér' : '↑ trending Ora')
      : '→ stable'
    : null;

  if (dp === null || dp === undefined) {
    return { regime: 'variable', estimatedKnots: null,
      description: 'No pressure data available', confidence: 'low', trend };
  }

  // ── PELÉR ────────────────────────────────────────────────────────────────
  if (dp < -5) {
    // Storm-level Pelér — exponential acceleration in the valley funnel
    const kn = Math.round(28 + (Math.abs(dp) - 5) * 3);
    return { regime: 'pelér', estimatedKnots: kn,
      description: 'Storm Pelér · extreme Alpine gradient',
      confidence: 'high', trend };
  }
  if (dp < -3) {
    // Calibration anchor: ΔP = −3 → 20 kn, ΔP = −5 → ~28 kn
    const kn = Math.round(20 + (Math.abs(dp) - 3) * 4);
    return { regime: 'pelér', estimatedKnots: kn,
      description: 'Strong Pelér · Bolzano strongly dominates',
      confidence: 'high', trend };
  }
  if (dp < -1.5) {
    // Onset zone: ΔP = −1.5 → ~10 kn, ΔP = −3 → 20 kn (linear interpolation)
    const kn = Math.round(10 + (Math.abs(dp) - 1.5) * 6.7);
    const suppressed = localHour !== null && localHour >= 18;
    return { regime: 'pelér', estimatedKnots: suppressed ? Math.round(kn * 0.6) : kn,
      description: suppressed ? 'Pelér fading · afternoon gradient weakening'
        : 'Pelér building · Bolzano dominates',
      confidence: suppressed ? 'low' : 'medium', trend };
  }

  // ── TRANSITIONAL ─────────────────────────────────────────────────────────
  if (dp <= 1.5) {
    return { regime: 'variable', estimatedKnots: null,
      description: 'Transitional · light & variable conditions',
      confidence: 'low', trend };
  }

  // ── ORA ──────────────────────────────────────────────────────────────────
  // Ora is thermally driven: time-of-day is a primary modulator
  const oraTooEarly = localHour !== null && localHour < 10;
  const oraPost = localHour !== null && localHour > 19;

  if (dp > 4) {
    const kn = Math.round(22 + (dp - 4) * 2.5);
    if (oraTooEarly) return { regime: 'variable', estimatedKnots: null,
      description: 'High Ghedi pressure · Ora not yet possible (too early)',
      confidence: 'low', trend };
    return { regime: 'ora', estimatedKnots: oraPost ? Math.round(kn * 0.7) : kn,
      description: 'Strong Ora · afternoon thermal in full swing',
      confidence: oraPost ? 'medium' : 'high', trend };
  }
  if (dp > 2) {
    // Calibration: ΔP = +3 → ~16 kn
    const kn = Math.round(8 + (dp - 1.5) * 5.3);
    if (oraTooEarly) return { regime: 'variable', estimatedKnots: null,
      description: 'Ora gradient present · thermal not yet established',
      confidence: 'low', trend };
    return { regime: 'ora', estimatedKnots: oraPost ? Math.round(kn * 0.7) : kn,
      description: 'Good Ora · Ghedi dominates, thermal building',
      confidence: 'high', trend };
  }
  // dp 1.5–2: marginal Ora onset
  const kn = Math.round(8 + (dp - 1.5) * 10);
  if (oraTooEarly) return { regime: 'variable', estimatedKnots: null,
    description: 'Weak Ghedi dominance · Ora cannot develop yet',
    confidence: 'low', trend };
  return { regime: 'ora', estimatedKnots: kn,
    description: 'Ora developing · weak thermal gradient',
    confidence: 'medium', trend };
}

/**
 * Convert degrees to 16-point compass direction label.
 * @param {number} degrees
 * @returns {string}
 */
export function degreesToCompass(degrees) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const ix = Math.round(normDeg(degrees) / 22.5) % 16;
  return dirs[ix];
}
