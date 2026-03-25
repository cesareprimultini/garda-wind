import { useState } from 'react';
import { MODELS } from '../utils/constants.js';
import WindSpeedChart from '../components/charts/WindSpeedChart.jsx';
import DeltaPressureChart from '../components/charts/DeltaPressureChart.jsx';
import DualPressureChart from '../components/charts/DualPressureChart.jsx';
import DayOutlookGrid from '../components/forecast/DayOutlookGrid.jsx';
import { ChartSkeleton } from '../components/shared/Skeleton.jsx';

// Meteotrentino WRF + ICON meteograms
const METEOGRAMS = [
  { key: 'icon-riva',  label: 'ICON D2 · Riva',        src: 'https://contenuti.meteotrentino.it/dati-meteo/meteogrammi/Icon2i_metgram_Riva.png' },
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

function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {options.map(opt => (
        <button
          key={opt.value ?? opt}
          onClick={() => onChange(opt.value ?? opt)}
          className={`pill ${(opt.value ?? opt) === value ? 'pill-active' : ''}`}
          style={{ fontSize: 11, padding: '3px 10px' }}
        >
          {opt.label ?? opt}
        </button>
      ))}
    </div>
  );
}

/**
 * Forecast panel — charts + 7-day outlook + Meteotrentino meteograms
 * Props: { data, loading, selectedModel, onModelChange }
 */
export default function ForecastPanel({ data, loading, selectedModel, onModelChange }) {
  const [timeRange, setTimeRange]     = useState('48h');
  const [imgErrors, setImgErrors]     = useState({});

  const hourly = data?.hourly ?? [];

  const timeRangeOpts = [
    { value: '24h', label: '24h' },
    { value: '48h', label: '48h' },
    { value: '7d',  label: '7d'  },
  ];

  return (
    <div className="panel-full" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Sticky controls bar */}
      <div
        style={{
          flexShrink: 0,
          background: 'var(--surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--glass-border)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <PillGroup
          options={MODELS.map(m => ({ value: m.id, label: m.label }))}
          value={selectedModel}
          onChange={onModelChange}
        />
        <PillGroup options={timeRangeOpts} value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Scrollable content */}
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
            {/* ΔP chart — THE key chart, first */}
            <div>
              <SectionLabel right="Bolzano − Ghedi">Pressure Differential</SectionLabel>
              <DeltaPressureChart data={hourly} timeRange={timeRange} onTimeRangeChange={setTimeRange} />
            </div>

            {/* Wind speed */}
            <div>
              <SectionLabel>Wind Speed & Gusts</SectionLabel>
              <WindSpeedChart data={hourly} timeRange={timeRange} />
            </div>

            {/* Dual pressure */}
            <div>
              <SectionLabel right="Bolzano vs Ghedi">Raw Pressure</SectionLabel>
              <DualPressureChart data={hourly} />
            </div>

            {/* 7-day outlook */}
            <div>
              <SectionLabel>7-Day Outlook</SectionLabel>
              <DayOutlookGrid data={hourly} />
            </div>

            {/* Meteotrentino meteograms */}
            <div>
              <SectionLabel right="updated twice daily">Meteotrentino Meteograms</SectionLabel>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                {METEOGRAMS.map(mg => (
                  <div key={mg.key} className="card" style={{ padding: '10px', overflow: 'hidden' }}>
                    <div className="section-label" style={{ marginBottom: 6 }}>{mg.label}</div>
                    {imgErrors[mg.key] ? (
                      <div style={{ fontSize: 10, color: 'var(--text-3)', padding: '8px 0' }}>
                        Image unavailable —{' '}
                        <a
                          href="https://www.meteotrentino.it"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#5090ff' }}
                        >
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
