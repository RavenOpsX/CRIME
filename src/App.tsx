import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DatasetProvider } from '@/components/DatasetProvider';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { NetworkAnalysis } from '@/pages/NetworkAnalysis';
import { DataExplorer } from '@/pages/DataExplorer';
import { Timeline } from '@/pages/Timeline';
import { Alerts } from '@/pages/Alerts';
import { AIAnalysis } from '@/pages/AIAnalysis';
import { Reports } from '@/pages/Reports';
import { SettingsPage } from '@/pages/Settings';
import { ImportData } from '@/pages/ImportData';

function App() {
  return (
    <DatasetProvider>
      {/*
        `basename` must match the Vite `base` option. On GitHub Pages the app
        lives under /CRIME/, so without it every route path below would fail to
        match the real pathname and <Routes> would render nothing at all.
        import.meta.env.BASE_URL is supplied by Vite, so the two can never drift.
      */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/network" element={<NetworkAnalysis />} />
            <Route path="/data" element={<DataExplorer />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/ai-analysis" element={<AIAnalysis />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/import" element={<ImportData />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Unknown paths fall back to the dashboard instead of a blank screen. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DatasetProvider>
  );
}

export default App;
