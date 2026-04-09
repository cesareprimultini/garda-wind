import { useState } from 'react';
import Header from './components/layout/Header.jsx';
import BottomNav from './components/layout/BottomNav.jsx';
import Dashboard from './views/Dashboard.jsx';
import MapPanel from './views/MapPanel.jsx';
import ForecastPanel from './views/ForecastPanel.jsx';
import BetaNotice from './components/BetaNotice.jsx';
import { useWeatherData } from './hooks/useWeatherData.js';
import { useRefreshCycle } from './hooks/useRefreshCycle.js';

/**
 * Root application component
 * Manages: active panel, selected station, selected model
 */
export default function App() {
  const [activePanel, setActivePanel] = useState('dashboard');
  const [selectedStation, setSelectedStation] = useState('torbole');
  const [selectedModel, setSelectedModel] = useState('meteofrance');

  const {
    data,
    loading,
    error,
    lastUpdated,
    activeModel,
    refresh,
    isRefreshing,
  } = useWeatherData(selectedStation, selectedModel);

  // 10-minute background refresh
  useRefreshCycle(refresh, lastUpdated);

  const handleStationChange = (stationId) => {
    setSelectedStation(stationId);
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Header
        stationId={selectedStation}
        onStationChange={handleStationChange}
        modelId={activeModel}
        onModelChange={handleModelChange}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
      />

      {/* Active panel — takes all remaining space */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activePanel === 'dashboard' && (
          <Dashboard
            data={data}
            loading={loading}
            error={error}
            stationId={selectedStation}
          />
        )}
        {activePanel === 'map' && (
          <MapPanel
            selectedStation={selectedStation}
            onStationSelect={(id) => {
              handleStationChange(id);
              setActivePanel('dashboard');
            }}
            modelId={selectedModel}
          />
        )}
        {activePanel === 'forecast' && (
          <ForecastPanel
            data={data}
            loading={loading}
            selectedModel={activeModel}
            onModelChange={handleModelChange}
            selectedStation={selectedStation}
          />
        )}
      </main>

      {/* Bottom navigation */}
      <BottomNav activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* Beta notice + persistent info button */}
      <BetaNotice />

    </div>
  );
}
