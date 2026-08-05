import { useState } from 'react';
import { DashboardRenderer } from './components/DashboardRenderer';
import { ChartRenderer } from './components/ChartRenderer';
import type { DashboardConfig, ChartConfig } from './types';

// Sample dashboard config - in production this comes from MCP UI
import sampleDashboard from './sample-data/sample-dashboard.json';

function App() {
  const [mode, setMode] = useState<'dashboard' | 'single'>('dashboard');

  return (
    <div className="app">
      <header className="app-header">
        <h1>MCP Dashboard MVP</h1>
        <p>Charts rendered from MCP UI JSON configs</p>
        <nav className="app-nav">
          <button
            className={mode === 'dashboard' ? 'active' : ''}
            onClick={() => setMode('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={mode === 'single' ? 'active' : ''}
            onClick={() => setMode('single')}
          >
            Single Chart
          </button>
        </nav>
      </header>

      <main className="app-main">
        {mode === 'dashboard' ? (
          <DashboardRenderer config={sampleDashboard as DashboardConfig} />
        ) : (
          <ChartRenderer config={(sampleDashboard as DashboardConfig).charts[0] as ChartConfig} />
        )}
      </main>
    </div>
  );
}

export default App;
