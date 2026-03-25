import { MODELS, STATIONS, PRESSURE_NODES } from '../utils/constants.js';
import { fetchDWDObserved, DWD_STATIONS } from './dwd.js';
import { fetchZAMGInnsbruck } from './zamg.js';

const ENSEMBLE_API = 'https://ensemble-api.open-meteo.com/v1/ensemble';

const HOURLY_VARS = [
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'pressure_msl',
  'temperature_2m',
  'cloud_cover',
  'precipitation',
  'weather_code',
].join(',');

const MINUTELY_15_VARS = [
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'pressure_msl',
].join(',');

const CURRENT_VARS = [
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'pressure_msl',
  'temperature_2m',
].join(',');

const BASE_PARAMS = {
  wind_speed_unit: 'kn',
  timezone: 'Europe/Rome',
  forecast_days: '7',
  past_days: '1',
};

/**
 * Fetch station weather data from Open-Meteo with model fallback.
 * Includes minutely_15 wind + pressure for high-resolution timeline.
 */
export async function fetchStationData(lat, lon, modelId) {
  const modelOrder = [
    modelId,
    ...MODELS.map(m => m.id).filter(id => id !== modelId),
  ];

  let lastError;
  for (const mId of modelOrder) {
    const model = MODELS.find(m => m.id === mId);
    if (!model) continue;

    const params = new URLSearchParams({
      ...BASE_PARAMS,
      latitude: lat,
      longitude: lon,
      hourly: HOURLY_VARS,
      minutely_15: MINUTELY_15_VARS,
      current: CURRENT_VARS,
    });

    const url = `${model.url}?${params.toString()}`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${model.label}`);
      const data = await resp.json();
      if (!data?.hourly?.time) throw new Error(`Invalid response from ${model.label}`);
      return { raw: data, usedModelId: mId };
    } catch (err) {
      console.warn(`[OpenMeteo] ${model.label} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All models failed');
}

/**
 * Fetch hourly + minutely_15 pressure for a pressure node location.
 * Uses /v1/forecast (most reliable for arbitrary coordinates).
 */
export async function fetchPressureNode(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'pressure_msl',
    minutely_15: 'pressure_msl',
    timezone: 'Europe/Rome',
    forecast_days: '7',
    past_days: '1',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching pressure node`);
  const data = await resp.json();
  if (!data?.hourly?.time) throw new Error('Invalid pressure node response');
  return data;
}

/**
 * Fetch 20-member ICON D2-EPS ensemble pressure for a location.
 * Used to derive ΔP confidence bands (min/max/spread across ensemble members).
 */
export async function fetchEnsemblePressure(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'pressure_msl',
    models: 'icon_d2_eps',
    forecast_days: '3',
    timezone: 'Europe/Rome',
  });

  const url = `${ENSEMBLE_API}?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ensemble`);
  const data = await resp.json();
  if (!data?.hourly?.time) throw new Error('Invalid ensemble response');
  return data;
}

/**
 * Orchestrate parallel fetching of station + all pressure nodes + ensemble ΔP.
 */
export async function fetchAllData(stationId, modelId) {
  const station = STATIONS.find(s => s.id === stationId);
  if (!station) throw new Error(`Unknown station: ${stationId}`);

  const [
    stationResult,
    bolzanoResult,
    ghediResult,
    trentoResult,
    veronaResult,
    innsbruckResult,
    bolzanoEnsResult,
    ghediEnsResult,
    dwdGhediResult,
    dwdInnsbruckResult,
    zamgInnsbruckResult,
  ] = await Promise.allSettled([
    fetchStationData(station.lat, station.lon, modelId),
    fetchPressureNode(PRESSURE_NODES.bolzano.lat,   PRESSURE_NODES.bolzano.lon),
    fetchPressureNode(PRESSURE_NODES.ghedi.lat,     PRESSURE_NODES.ghedi.lon),
    fetchPressureNode(PRESSURE_NODES.trento.lat,    PRESSURE_NODES.trento.lon),
    fetchPressureNode(PRESSURE_NODES.verona.lat,    PRESSURE_NODES.verona.lon),
    fetchPressureNode(PRESSURE_NODES.innsbruck.lat, PRESSURE_NODES.innsbruck.lon),
    fetchEnsemblePressure(PRESSURE_NODES.bolzano.lat, PRESSURE_NODES.bolzano.lon),
    fetchEnsemblePressure(PRESSURE_NODES.ghedi.lat,   PRESSURE_NODES.ghedi.lon),
    fetchDWDObserved(DWD_STATIONS.ghedi),
    fetchDWDObserved(DWD_STATIONS.innsbruck),
    fetchZAMGInnsbruck(),
  ]);

  if (stationResult.status === 'rejected') throw stationResult.reason;

  const { raw: stationRaw, usedModelId } = stationResult.value;

  const logFail = (name, result) => {
    if (result.status === 'rejected') {
      console.warn(`[OpenMeteo] ${name} failed:`, result.reason?.message);
    }
  };
  logFail('Bolzano',           bolzanoResult);
  logFail('Ghedi',             ghediResult);
  logFail('Trento',            trentoResult);
  logFail('Verona',            veronaResult);
  logFail('Innsbruck',         innsbruckResult);
  logFail('Bolzano ensemble',  bolzanoEnsResult);
  logFail('Ghedi ensemble',    ghediEnsResult);
  logFail('DWD Ghedi obs',     dwdGhediResult);
  logFail('DWD Innsbruck obs', dwdInnsbruckResult);
  logFail('ZAMG Innsbruck obs',zamgInnsbruckResult);

  return {
    stationRaw,
    usedModelId,
    bolzanoRaw:        bolzanoResult.status       === 'fulfilled' ? bolzanoResult.value       : null,
    ghediRaw:          ghediResult.status         === 'fulfilled' ? ghediResult.value         : null,
    trentoRaw:         trentoResult.status        === 'fulfilled' ? trentoResult.value        : null,
    veronaRaw:         veronaResult.status        === 'fulfilled' ? veronaResult.value        : null,
    innsbruckRaw:      innsbruckResult.status     === 'fulfilled' ? innsbruckResult.value     : null,
    bolzanoEnsemble:   bolzanoEnsResult.status    === 'fulfilled' ? bolzanoEnsResult.value    : null,
    ghediEnsemble:     ghediEnsResult.status      === 'fulfilled' ? ghediEnsResult.value      : null,
    // Observed (real-time measured) — may be null if source is down
    dwdGhediObs:       dwdGhediResult.status      === 'fulfilled' ? dwdGhediResult.value      : null,
    dwdInnsbruckObs:   dwdInnsbruckResult.status  === 'fulfilled' ? dwdInnsbruckResult.value  : null,
    zamgInnsbruckObs:  zamgInnsbruckResult.status === 'fulfilled' ? zamgInnsbruckResult.value : null,
  };
}

/**
 * Fetch data for all stations in parallel (for map view).
 */
export async function fetchAllStations(modelId) {
  const results = await Promise.allSettled(
    STATIONS.map(station =>
      fetchStationData(station.lat, station.lon, modelId)
        .then(r => ({ stationId: station.id, raw: r.raw, usedModelId: r.usedModelId, error: null }))
    )
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return { stationId: STATIONS[i].id, raw: null, usedModelId: null, error: result.reason?.message };
  });
}
