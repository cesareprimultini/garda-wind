export const STATIONS = [
  { id: 'torbole', name: 'Torbole', lat: 45.8689, lon: 10.8734 },
  { id: 'riva', name: 'Riva del Garda', lat: 45.8864, lon: 10.8389 },
  { id: 'malcesine', name: 'Malcesine', lat: 45.7609, lon: 10.8118 },
  { id: 'campione', name: 'Campione', lat: 45.7822, lon: 10.7634 },
  { id: 'bardolino', name: 'Bardolino', lat: 45.5494, lon: 10.7272 },
  { id: 'leganavale', name: 'Lega Navale Garda', lat: 45.5775, lon: 10.7017 },
  { id: 'peschiera', name: 'Peschiera', lat: 45.4394, lon: 10.6926 },
];

export const PRESSURE_NODES = {
  bolzano:   { lat: 46.4983, lon: 11.3548, label: 'Bolzano' },
  ghedi:     { lat: 45.4083, lon: 10.2671, label: 'Ghedi' },
  trento:    { lat: 46.0748, lon: 11.1217, label: 'Trento' },
  verona:    { lat: 45.4384, lon: 10.9916, label: 'Verona' },
  innsbruck: { lat: 47.2692, lon: 11.4041, label: 'Innsbruck' },
};

export const MODELS = [
  { id: 'meteofrance', label: 'AROME 1.3km', url: '/api/openmeteo?_path=v1/meteofrance' },
  { id: 'dwd_icon', label: 'ICON D2 2km', url: '/api/openmeteo?_path=v1/dwd-icon' },
  { id: 'forecast', label: 'Best Match', url: '/api/openmeteo?_path=v1/forecast' },
];

export const QUALITY_COLORS = {
  none:     '#324158',
  marginal: '#38bdf8',
  good:     '#0dcfa8',
  advanced: '#f5a428',
  storm:    '#f43f5e',
};

export const QUALITY_LABELS = {
  none:     'No Wind',
  marginal: 'Marginal',
  good:     'Session On',
  advanced: 'Advanced',
  storm:    'Too Strong',
};

export const REGIME_COLORS = {
  'pelér':    '#5090ff',
  'peler':    '#5090ff',
  'ora':      '#f5a428',
  'variable': '#4a5a70',
};

export const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const CACHE_STALE_MS = 60 * 60 * 1000; // 1 hour
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
