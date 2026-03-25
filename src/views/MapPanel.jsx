import { useState, useEffect, useCallback } from 'react';
import { STATIONS, QUALITY_COLORS, REGIME_COLORS } from '../utils/constants.js';
import { fetchAllStations } from '../api/openmeteo.js';
import { transformData } from '../api/transform.js';
import { getQuality, getKiteSize, detectRegime, degreesToCompass } from '../utils/windPhysics.js';

// Dynamic import for leaflet components to avoid SSR issues
let MapContainer, TileLayer, CircleMarker, Popup;

/**
 * Map panel showing all stations with live wind markers
 * Props: { selectedStation, onStationSelect, modelId }
 */
export default function MapPanel({ selectedStation, onStationSelect, modelId }) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [stationsData, setStationsData] = useState({});
  const [loadingStations, setLoadingStations] = useState(true);
  const [mapError, setMapError] = useState(null);

  // Load leaflet dynamically
  useEffect(() => {
    Promise.all([
      import('react-leaflet'),
      import('leaflet/dist/leaflet.css'),
    ])
      .then(([rl]) => {
        MapContainer = rl.MapContainer;
        TileLayer = rl.TileLayer;
        CircleMarker = rl.CircleMarker;
        Popup = rl.Popup;
        setLeafletLoaded(true);
      })
      .catch(err => {
        console.error('[MapPanel] Leaflet load failed:', err);
        setMapError('Map failed to load. Please refresh.');
      });
  }, []);

  const loadStationData = useCallback(async () => {
    setLoadingStations(true);
    try {
      const results = await fetchAllStations(modelId);
      const byId = {};
      for (const r of results) {
        if (r.raw) {
          try {
            const transformed = transformData(r.raw, null, null);
            byId[r.stationId] = {
              current: transformed.current,
              regime: transformed.currentRegime,
              quality: transformed.currentQuality,
              kiteSize: transformed.currentKiteSize,
            };
          } catch (e) {
            console.warn(`[MapPanel] Transform failed for ${r.stationId}:`, e);
          }
        }
      }
      setStationsData(byId);
    } catch (err) {
      console.error('[MapPanel] Station load failed:', err);
    } finally {
      setLoadingStations(false);
    }
  }, [modelId]);

  useEffect(() => {
    loadStationData();
  }, [loadStationData]);

  if (mapError) {
    return (
      <div className="panel-full flex items-center justify-center p-6">
        <div className="card p-6 text-center max-w-sm">
          <div className="text-3xl mb-3">🗺️</div>
          <div className="text-sm" style={{ color: '#324158' }}>{mapError}</div>
        </div>
      </div>
    );
  }

  if (!leafletLoaded) {
    return (
      <div className="panel-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: '#324158' }}>Loading map…</div>
      </div>
    );
  }

  return (
    <div className="panel-full" style={{ position: 'relative' }}>
      {/* Loading overlay */}
      {loadingStations && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--card)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            color: '#6a8099',
          }}
        >
          Loading station data…
        </div>
      )}

      <MapContainer
        center={[45.65, 10.75]}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        {/* Dark CartoDB tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Station markers */}
        {STATIONS.map(station => {
          const sd = stationsData[station.id];
          const quality = sd?.quality ?? 'none';
          const regime = sd?.regime ?? 'variable';
          const current = sd?.current;
          const windSpeed = current?.windSpeed ?? null;
          const windDir = current?.windDir ?? null;
          const kiteSize = sd?.kiteSize ?? '—';

          const color = QUALITY_COLORS[quality] ?? QUALITY_COLORS.none;
          const isSelected = station.id === selectedStation;
          const radius = isSelected ? 14 : 10;

          return (
            <CircleMarker
              key={station.id}
              center={[station.lat, station.lon]}
              radius={radius}
              pathOptions={{
                color: isSelected ? '#ffffff' : color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => onStationSelect(station.id),
              }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text-1)' }}>
                    {station.name}
                  </div>

                  {windSpeed !== null ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color }}>
                        {Math.round(windSpeed)} <span style={{ fontSize: 12, fontWeight: 400, color: '#324158' }}>kn</span>
                      </div>
                      {windDir !== null && (
                        <div style={{ fontSize: 12, color: '#6a8099', marginBottom: 4 }}>
                          {degreesToCompass(windDir)} · {Math.round(windDir)}°
                        </div>
                      )}
                      <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>
                        {regime}
                      </div>
                      <div style={{ fontSize: 11, color: '#324158' }}>
                        Kite: <span style={{ color: '#6a8099' }}>{kiteSize}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: '#324158' }}>
                      {loadingStations ? 'Loading…' : 'No data'}
                    </div>
                  )}

                  <button
                    onClick={() => onStationSelect(station.id)}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      padding: '4px 0',
                      background: 'rgba(77,143,255,0.15)',
                      border: '1px solid rgba(77,143,255,0.4)',
                      borderRadius: 6,
                      color: '#4d8fff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View Dashboard
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 8,
          zIndex: 500,
          background: 'var(--card)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: '8px 10px',
          fontSize: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {Object.entries(QUALITY_COLORS).map(([q, color]) => (
          <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ color: '#324158', textTransform: 'capitalize' }}>{q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
