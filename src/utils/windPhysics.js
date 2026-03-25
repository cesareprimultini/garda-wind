/**
 * Wind physics and meteorological interpretation for Lake Garda
 * ΔP = Bolzano pressure − Ghedi pressure
 * Negative ΔP → Pelér (N→S), Positive ΔP → Ora (S→N)
 */

/**
 * Detect wind regime from ΔP and optional wind direction backup
 * @param {number|null} dp - Pressure differential (Bolzano − Ghedi) in hPa
 * @param {number|null} windDir - Wind direction in degrees (0-360)
 * @returns {'pelér'|'ora'|'variable'}
 */
export function detectRegime(dp, windDir = null) {
  if (dp !== null && dp !== undefined) {
    if (dp < -1.5) return 'pelér';
    if (dp > 1.5) return 'ora';
  }

  // Fallback to wind direction if ΔP is ambiguous
  if (windDir !== null && windDir !== undefined) {
    // Pelér: northerly (315-45°), Ora: southerly (135-225°)
    const dir = ((windDir % 360) + 360) % 360;
    if (dir >= 315 || dir <= 45) return 'pelér';
    if (dir >= 135 && dir <= 225) return 'ora';
  }

  return 'variable';
}

/**
 * Get session quality label from wind speed in knots
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
 * Get recommended kite size from wind speed in knots
 * @param {number} windSpeed - Wind speed in knots
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
 * Get recommended windsurf sail size from wind speed in knots
 * @param {number} windSpeed - Wind speed in knots
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
 * Get recommended wing size for wing foiling from wind speed in knots
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
 * Get recommended kite size for kite foiling from wind speed in knots
 * Foil kites work at lower wind than twin-tip kites
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
 * Get session status for a sport at a given wind speed
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
 * Get full interpretation of ΔP value
 * @param {number|null} dp - Pressure differential in hPa
 * @returns {{ regime: string, estimatedKnots: number|null, description: string, confidence: string }}
 */
export function getDpInterpretation(dp) {
  if (dp === null || dp === undefined) {
    return {
      regime: 'variable',
      estimatedKnots: null,
      description: 'No pressure data available',
      confidence: 'low',
    };
  }

  if (dp < -5) {
    return {
      regime: 'pelér',
      estimatedKnots: Math.round(20 + Math.abs(dp + 3) * 4),
      description: `Strong Pelér · Bolzano dominates strongly`,
      confidence: 'high',
    };
  }
  if (dp < -3) {
    return {
      regime: 'pelér',
      estimatedKnots: Math.round(18 + (Math.abs(dp) - 3) * 3),
      description: `Pelér developing · ~20 kn expected`,
      confidence: 'high',
    };
  }
  if (dp < -1.5) {
    const kn = Math.round(10 + (Math.abs(dp) - 1.5) * 5);
    return {
      regime: 'pelér',
      estimatedKnots: kn,
      description: `Pelér building · Bolzano dominates`,
      confidence: 'medium',
    };
  }
  if (dp <= 1.5) {
    return {
      regime: 'variable',
      estimatedKnots: null,
      description: `Transitional · light & variable`,
      confidence: 'low',
    };
  }
  if (dp < 2) {
    const kn = Math.round(8 + (dp - 1.5) * 10);
    return {
      regime: 'ora',
      estimatedKnots: kn,
      description: `Ora developing · thermal building`,
      confidence: 'medium',
    };
  }
  if (dp < 4) {
    const kn = Math.round(14 + (dp - 2) * 4);
    return {
      regime: 'ora',
      estimatedKnots: kn,
      description: `Good Ora session · Ghedi dominates`,
      confidence: 'high',
    };
  }
  return {
    regime: 'ora',
    estimatedKnots: Math.round(22 + (dp - 4) * 3),
    description: `Strong Ora · afternoon thermal in full swing`,
    confidence: 'high',
  };
}

/**
 * Convert degrees to compass direction label
 * @param {number} degrees
 * @returns {string}
 */
export function degreesToCompass(degrees) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const ix = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return dirs[ix];
}
