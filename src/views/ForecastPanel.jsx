import { useState, useEffect } from 'react';
import { fetchObservations } from '../api/observations.js';
import WindSpeedChart from '../components/charts/WindSpeedChart.jsx';
import ModelAccuracyChart from '../components/charts/ModelAccuracyChart.jsx';
import DeltaPressureChart from '../components/charts/DeltaPressureChart.jsx';
import DualPressureChart from '../components/charts/DualPressureChart.jsx';
import WindHeatmap from '../components/charts/WindHeatmap.jsx';
import DayOutlookGrid from '../components/forecast/DayOutlookGrid.jsx';
import { ChartSkeleton } from '../components/shared/Skeleton.jsx';

// Meteotrentino WRF + ICON meteograms
const METEOGRAMS = [
  { key: 'icon-riva',  label: 'ICON D2 · Riva',         src: 'https://contenuti.meteotrentino.it/dati-meteo/meteogrammi/Icon2i_metgram_Riva.png' },
  { key: 'icon-medio', label: 'ICON D2 · Medio Garda',  src: 'https://contenuti.meteotrentino.it/dati-meteo/meteogrammi/Icon2i_metgram_MedioGarda.png' },
  { key: 'wrf-riva',   label: 'WRF 1km · Riva',         src: 'https://contenuti.meteotrentino.it/dati-meteo/meteogrammi/riva_garda.png' },
  { key: 'wrf-medio',  label: 'WRF 1km · Medio Garda',  src: 'https://contenuti.meteotrentino.it/dati-meteo/meteogrammi/medio_garda.png' },
];

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <span className="section-label">{children}</span>
      {right && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{right}</span>}
    </div>
  );
}

/**
 * Forecast panel — charts + 7-day outlook + Meteotrentino meteograms
 * Props: { data, loading, selectedStation }
 */
export default function ForecastPanel({ data, loading, selectedStation }) {
  const [imgErrors, setImgErrors]   = useState({});
  const [obsData, setObsData]       = useState([]);
  const [obsLoading, setObsLoading] = useState(false);

  useEffect(() => {
    if (!selectedStation) return;
    let cancelled = false;
    setObsLoading(true);
    fetchObservations(selectedStation).then(rows => {
      if (!cancelled) { setObsData(rows); setObsLoading(false); }
    });
    return () => { cancelled = true; };
  }, [selectedStation]);

  const hourlyRaw   = data?.hourly      ?? [];
  const liveHistory = data?.liveHistory ?? [];

  return (
    <div className="panel-full" style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {loading && !data ? (
          <>
            <ChartSkeleton height={200} />
            <ChartSkeleton height={180} />
            <ChartSkeleton height={150} />
          </>
        ) : (
          <>
            <div>
              <SectionLabel right="scroll →">Session Windows</SectionLabel>
              <WindHeatmap data={hourlyRaw} />
            </div>

            <div>
              <SectionLabel right="Bolzano − Ghedi">Pressure Differential</SectionLabel>
              <DeltaPressureChart data={hourlyRaw} />
            </div>

            <div>
              <SectionLabel right={liveHistory.length > 0 ? 'model + live observed' : 'model'}>
                Wind Speed & Gusts
              </SectionLabel>
              <WindSpeedChart data={hourlyRaw} liveHistory={liveHistory} />
            </div>

            <div>
              <SectionLabel right="AROME · ΔP estimate · live station">
                Forecast Reliability
              </SectionLabel>
              <ModelAccuracyChart data={hourlyRaw} observations={obsData} loading={obsLoading} />
            </div>

            <div>
              <SectionLabel right="Bolzano vs Ghedi">Raw Pressure</SectionLabel>
              <DualPressureChart data={hourlyRaw} />
            </div>

            <div>
              <SectionLabel>7-Day Outlook</SectionLabel>
              <DayOutlookGrid data={hourlyRaw} />
            </div>

            <div>
              <SectionLabel right="updated twice daily">Meteotrentino Meteograms</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {METEOGRAMS.map(mg => (
                  <div key={mg.key} className="card" style={{ padding: '10px', overflow: 'hidden' }}>
                    <div className="section-label" style={{ marginBottom: 6 }}>{mg.label}</div>
                    {imgErrors[mg.key] ? (
                      <div style={{ fontSize: 10, color: 'var(--text-3)', padding: '8px 0' }}>
                        Image unavailable —{' '}
                        <a href="https://www.meteotrentino.it" target="_blank" rel="noopener noreferrer" style={{ color: '#5090ff' }}>
                          meteotrentino.it
                        </a>
                      </div>
                    ) : (
                      <img
                        src={mg.src}
                        alt={mg.label}
                        loading="lazy"
                        style={{ width: '100%', borderRadius: 8, display: 'block' }}
                        onError={() => setImgErrors(e => ({ ...e, [mg.key]: true }))}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>
                ICON D2 (2km) + WRF UniTN (1km) · Meteotrentino / Provincia Autonoma di Trento
              </div>
            </div>

            <div style={{ height: 4 }} />
          </>
        )}
      </div>
    </div>
  );
}
