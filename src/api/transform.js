import { detectRegime, getQuality, getKiteSize, getDpInterpretation } from '../utils/windPhysics.js';

/**
 * Build a timestamp-keyed map from parallel time/value arrays.
 * Keys are normalized to YYYY-MM-DDTHH:mm for matching.
 */
function buildPressureMap(times, pressures) {
  const map = new Map();
  if (!times || !pressures) return map;
  for (let i = 0; i < times.length; i++) {
    map.set(times[i].substring(0, 16), pressures[i]);
  }
  return map;
}

/**
 * Extract all ensemble member pressure arrays from Open-Meteo ensemble response.
 * Returns an array of {time, pressures[]} where pressures has one value per member.
 * @param {object} ensembleRaw
 * @returns {Map<string, number[]>} timeKey → array of pressures across all members
 */
function buildEnsemblePressureMap(ensembleRaw) {
  const map = new Map();
  if (!ensembleRaw?.hourly) return map;

  const { time, ...fields } = ensembleRaw.hourly;
  // Collect member keys: pressure_msl, pressure_msl_member01..19
  const memberKeys = Object.keys(fields).filter(k => k.startsWith('pressure_msl'));

  for (let i = 0; i < time.length; i++) {
    const key = time[i].substring(0, 16);
    const values = memberKeys
      .map(k => fields[k]?.[i])
      .filter(v => v != null && !isNaN(v));
    if (values.length > 0) map.set(key, values);
  }
  return map;
}

/**
 * Compute ΔP ensemble statistics from two ensemble pressure maps at the same time key.
 * Each member dp_i = bolzanoMember_i − ghediMember_i (paired by index).
 * Returns { mean, min, max, spread, agreementFraction } or null.
 */
function calcEnsembleDp(bolzanoValues, ghediValues) {
  if (!bolzanoValues?.length || !ghediValues?.length) return null;
  const len = Math.min(bolzanoValues.length, ghediValues.length);
  const dps = [];
  for (let i = 0; i < len; i++) {
    dps.push(bolzanoValues[i] - ghediValues[i]);
  }
  const mean = dps.reduce((a, b) => a + b, 0) / dps.length;
  const min  = Math.min(...dps);
  const max  = Math.max(...dps);
  // Agreement: fraction of members whose regime matches the mean regime
  const meanRegime = detectRegime(mean, null);
  const agreeing = dps.filter(dp => detectRegime(dp, null) === meanRegime).length;
  return {
    mean: parseFloat(mean.toFixed(2)),
    min:  parseFloat(min.toFixed(2)),
    max:  parseFloat(max.toFixed(2)),
    spread: parseFloat((max - min).toFixed(2)),
    agreementFraction: parseFloat((agreeing / dps.length).toFixed(2)),
    regime: meanRegime,
    memberCount: dps.length,
  };
}

/**
 * Transform raw Open-Meteo responses into the app data model.
 *
 * @param {object}      stationRaw       - Full station response (hourly + minutely_15 + current)
 * @param {object|null} bolzanoRaw       - Bolzano pressure node (hourly + minutely_15)
 * @param {object|null} ghediRaw         - Ghedi pressure node (hourly + minutely_15)
 * @param {object}      [opts]
 * @param {object|null} opts.trentoRaw        - Trento pressure node (forecast)
 * @param {object|null} opts.veronaRaw        - Verona pressure node (forecast)
 * @param {object|null} opts.innsbruckRaw     - Innsbruck pressure node (forecast)
 * @param {object|null} opts.bolzanoEnsemble  - Bolzano 20-member ensemble
 * @param {object|null} opts.ghediEnsemble    - Ghedi 20-member ensemble
 * @param {object|null} opts.dwdGhediObs      - DWD observed: Ghedi/Brescia (16088)
 * @param {object|null} opts.dwdInnsbruckObs  - DWD observed: Innsbruck airport (11120)
 * @param {object|null} opts.zamgInnsbruckObs - ZAMG TAWES observed: Innsbruck Uni (11320)
 */
export function transformData(stationRaw, bolzanoRaw, ghediRaw, opts = {}) {
  const {
    trentoRaw       = null,
    veronaRaw       = null,
    innsbruckRaw    = null,
    bolzanoEnsemble = null,
    ghediEnsemble   = null,
    dwdGhediObs     = null,
    dwdInnsbruckObs = null,
    zamgInnsbruckObs = null,
  } = opts;

  const now = new Date();
  const h   = stationRaw.hourly;
  const m15 = stationRaw.minutely_15;

  // --- Hourly pressure maps ---
  const bolzanoMap    = buildPressureMap(bolzanoRaw?.hourly?.time,    bolzanoRaw?.hourly?.pressure_msl);
  const ghediMap      = buildPressureMap(ghediRaw?.hourly?.time,      ghediRaw?.hourly?.pressure_msl);
  const trentoMap     = buildPressureMap(trentoRaw?.hourly?.time,     trentoRaw?.hourly?.pressure_msl);
  const veronaMap     = buildPressureMap(veronaRaw?.hourly?.time,     veronaRaw?.hourly?.pressure_msl);
  const innsbruckMap  = buildPressureMap(innsbruckRaw?.hourly?.time,  innsbruckRaw?.hourly?.pressure_msl);

  // --- Minutely_15 pressure maps ---
  const bolzanoMap15   = buildPressureMap(bolzanoRaw?.minutely_15?.time,   bolzanoRaw?.minutely_15?.pressure_msl);
  const ghediMap15     = buildPressureMap(ghediRaw?.minutely_15?.time,     ghediRaw?.minutely_15?.pressure_msl);
  const innsbruckMap15 = buildPressureMap(innsbruckRaw?.minutely_15?.time, innsbruckRaw?.minutely_15?.pressure_msl);

  // --- Ensemble pressure maps (time → array of member values) ---
  const bolzanoEnsMaps = buildEnsemblePressureMap(bolzanoEnsemble);
  const ghediEnsMaps   = buildEnsemblePressureMap(ghediEnsemble);

  // --- Find nowIndex in hourly data ---
  let nowIndex = 0;
  let minDiff  = Infinity;
  for (let i = 0; i < h.time.length; i++) {
    const diff = Math.abs(new Date(h.time[i]) - now);
    if (diff < minDiff) { minDiff = diff; nowIndex = i; }
  }

  // --- Build hourly array ---
  const hourly = h.time.map((time, i) => {
    const timeKey = time.substring(0, 16);

    const bolzanoPressure   = bolzanoMap.get(timeKey)   ?? null;
    const ghediPressure     = ghediMap.get(timeKey)     ?? null;
    const trentoPressure    = trentoMap.get(timeKey)    ?? null;
    const veronaPressure    = veronaMap.get(timeKey)    ?? null;
    const innsbruckPressure = innsbruckMap.get(timeKey) ?? null;

    // Primary ΔP: Bolzano − Ghedi
    const dp = bolzanoPressure !== null && ghediPressure !== null
      ? parseFloat((bolzanoPressure - ghediPressure).toFixed(2))
      : null;

    // Extended gradient: Innsbruck − Ghedi (Pelér synoptic strength)
    const dpNorth = innsbruckPressure !== null && ghediPressure !== null
      ? parseFloat((innsbruckPressure - ghediPressure).toFixed(2))
      : null;

    // Ensemble ΔP statistics
    const ensembleDp = calcEnsembleDp(
      bolzanoEnsMaps.get(timeKey),
      ghediEnsMaps.get(timeKey),
    );

    const windSpeed   = h.wind_speed_10m?.[i]    ?? null;
    const windGusts   = h.wind_gusts_10m?.[i]    ?? null;
    const windDir     = h.wind_direction_10m?.[i] ?? null;
    const pressure    = h.pressure_msl?.[i]       ?? null;
    const temp        = h.temperature_2m?.[i]     ?? null;
    const cloud       = h.cloud_cover?.[i]        ?? null;
    const precip      = h.precipitation?.[i]      ?? null;
    const weatherCode = h.weather_code?.[i]       ?? null;

    const regime      = detectRegime(dp, windDir);
    const quality     = getQuality(windSpeed);
    const kiteSizeLabel = getKiteSize(windSpeed);
    const dpInterp    = getDpInterpretation(dp);
    const diffH       = Math.round((new Date(time) - now) / 3600000);

    return {
      time,
      diffH,
      isNow: i === nowIndex,
      windSpeed,
      windGusts,
      windDir,
      pressure,
      temp,
      cloud,
      precip,
      weatherCode,
      // Primary pressure nodes
      bolzanoPressure,
      ghediPressure,
      trentoPressure,
      veronaPressure,
      innsbruckPressure,
      // ΔP variants
      dp,
      dpNorth,
      // Ensemble ΔP (null outside 3-day ensemble window)
      dpEnsembleMean:       ensembleDp?.mean             ?? null,
      dpEnsembleMin:        ensembleDp?.min              ?? null,
      dpEnsembleMax:        ensembleDp?.max              ?? null,
      dpEnsembleSpread:     ensembleDp?.spread           ?? null,
      dpAgreementFraction:  ensembleDp?.agreementFraction ?? null,
      dpEnsembleRegime:     ensembleDp?.regime           ?? null,
      dpEnsembleMemberCount: ensembleDp?.memberCount     ?? null,
      // Derived
      regime,
      quality,
      kiteSizeLabel,
      estimatedWindFromDp: dpInterp.estimatedKnots,
    };
  });

  // --- Build minutely_15 array ---
  let minutely15 = [];
  if (m15?.time?.length) {
    minutely15 = m15.time.map((time, i) => {
      const timeKey = time.substring(0, 16);

      const bolzanoPressure15   = bolzanoMap15.get(timeKey)   ?? null;
      const ghediPressure15     = ghediMap15.get(timeKey)     ?? null;
      const innsbruckPressure15 = innsbruckMap15.get(timeKey) ?? null;

      const dp15 = bolzanoPressure15 !== null && ghediPressure15 !== null
        ? parseFloat((bolzanoPressure15 - ghediPressure15).toFixed(2))
        : null;

      const dpNorth15 = innsbruckPressure15 !== null && ghediPressure15 !== null
        ? parseFloat((innsbruckPressure15 - ghediPressure15).toFixed(2))
        : null;

      const windSpeed = m15.wind_speed_10m?.[i]     ?? null;
      const windGusts = m15.wind_gusts_10m?.[i]     ?? null;
      const windDir   = m15.wind_direction_10m?.[i] ?? null;
      const pressure  = m15.pressure_msl?.[i]       ?? null;

      return {
        time,
        windSpeed,
        windGusts,
        windDir,
        pressure,
        bolzanoPressure15,
        ghediPressure15,
        innsbruckPressure15,
        dp: dp15,
        dpNorth: dpNorth15,
        regime: detectRegime(dp15, windDir),
        quality: getQuality(windSpeed),
      };
    });
  }

  // --- Current conditions ---
  const c = stationRaw.current;
  let current;
  if (c && c.wind_speed_10m !== undefined) {
    current = {
      windSpeed: c.wind_speed_10m,
      windGusts: c.wind_gusts_10m,
      windDir:   c.wind_direction_10m,
      pressure:  c.pressure_msl,
      temp:      c.temperature_2m,
      time:      c.time || now.toISOString(),
    };
  } else {
    const nowEntry = hourly[nowIndex];
    current = {
      windSpeed: nowEntry?.windSpeed ?? null,
      windGusts: nowEntry?.windGusts ?? null,
      windDir:   nowEntry?.windDir   ?? null,
      pressure:  nowEntry?.pressure  ?? null,
      temp:      nowEntry?.temp      ?? null,
      time:      nowEntry?.time      ?? now.toISOString(),
    };
  }

  // --- Current ΔP: prefer minutely_15 nearest now, fallback to hourly ---
  let currentDp = null;
  let currentDpEnsemble = null;

  // Try minutely_15 for most recent dp
  if (minutely15.length > 0) {
    let minDiff15 = Infinity;
    for (const entry of minutely15) {
      const diff = Math.abs(new Date(entry.time) - now);
      if (diff < minDiff15 && entry.dp !== null) {
        minDiff15 = diff;
        currentDp = entry.dp;
      }
    }
  }

  // Fallback to hourly if no minutely dp available
  if (currentDp === null) {
    for (let offset = 0; offset <= 2; offset++) {
      for (const sign of [0, -1, 1]) {
        const idx = nowIndex + sign * offset;
        if (idx >= 0 && idx < hourly.length && hourly[idx].dp !== null) {
          currentDp = hourly[idx].dp;
          break;
        }
      }
      if (currentDp !== null) break;
    }
  }

  // Current ensemble dp from nearest hourly entry
  for (let offset = 0; offset <= 2; offset++) {
    for (const sign of [0, -1, 1]) {
      const idx = nowIndex + sign * offset;
      if (idx >= 0 && idx < hourly.length && hourly[idx].dpEnsembleMean !== null) {
        currentDpEnsemble = {
          mean:              hourly[idx].dpEnsembleMean,
          min:               hourly[idx].dpEnsembleMin,
          max:               hourly[idx].dpEnsembleMax,
          spread:            hourly[idx].dpEnsembleSpread,
          agreementFraction: hourly[idx].dpAgreementFraction,
          regime:            hourly[idx].dpEnsembleRegime,
          memberCount:       hourly[idx].dpEnsembleMemberCount,
        };
        break;
      }
    }
    if (currentDpEnsemble !== null) break;
  }

  const currentRegime   = detectRegime(currentDp, current.windDir);
  const currentQuality  = getQuality(current.windSpeed);
  const currentKiteSize = getKiteSize(current.windSpeed);

  // --- Observed (real-time measured) data summary ---
  // Innsbruck observed: prefer ZAMG (10-min), fallback DWD (hourly)
  const innsbruckObsMslp =
    zamgInnsbruckObs?.mslp   ??
    dwdInnsbruckObs?.mslp    ?? null;

  const innsbruckObsWind = zamgInnsbruckObs
    ? {
        speedMs: zamgInnsbruckObs.windSpeedMs,
        gustMs:  zamgInnsbruckObs.gustMs,
        dir:     zamgInnsbruckObs.windDir,
        temp:    zamgInnsbruckObs.temp,
        time:    zamgInnsbruckObs.time,
        source:  'ZAMG TAWES 11320',
      }
    : dwdInnsbruckObs
    ? {
        speedMs: dwdInnsbruckObs.windSpeedKmh != null ? dwdInnsbruckObs.windSpeedKmh / 3.6 : null,
        gustMs:  null,
        dir:     dwdInnsbruckObs.windDir,
        temp:    dwdInnsbruckObs.temp,
        time:    dwdInnsbruckObs.time,
        source:  'DWD POI 11120',
      }
    : null;

  const observed = {
    // Ghedi observed MSLP from DWD (the real southern ΔP anchor)
    ghediMslp:      dwdGhediObs?.mslp    ?? null,
    ghediTime:      dwdGhediObs?.time    ?? null,
    ghediSource:    dwdGhediObs          ? 'DWD POI 16088' : null,
    // Innsbruck observed MSLP (northern gradient node)
    innsbruckMslp:  innsbruckObsMslp,
    innsbruckWind:  innsbruckObsWind,
    innsbruckSource: innsbruckObsWind?.source ?? null,
  };

  return {
    hourly,
    minutely15,
    current,
    currentDp,
    currentDpEnsemble,
    currentRegime,
    currentQuality,
    currentKiteSize,
    observed,
  };
}
