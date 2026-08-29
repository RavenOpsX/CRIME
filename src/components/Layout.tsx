import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useDatasetContext } from '@/hooks/useDatasetContext';

export function Layout() {
  const { dataset, loading } = useDatasetContext();

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-ink-900/90 backdrop-blur-md border-b border-ink-700 px-6 py-3 flex items-center justify-between">
          <h1>THREADLINE</h1>
          <h2>AI Powered Criminal Network Analysis</h2>
          <GlobalSearch dataset={dataset} />
          <div className="flex items-center gap-4">
            {dataset ? (
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-signal-green animate-pulse" />
                  Dataset loaded
                </span>
                <span className="text-gray-600">|</span>
                <span>{dataset.entities.length} entities</span>
                <span className="text-gray-600">|</span>
                <span>{dataset.relationships.length} relationships</span>
                {dataset.metadata.lastAnalyzed && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span>Analyzed: {new Date(dataset.metadata.lastAnalyzed).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No dataset loaded</span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
