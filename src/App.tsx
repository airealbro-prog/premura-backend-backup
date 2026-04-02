import { useState, useCallback } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { Overview } from "./components/views/Overview";
import { ClientView } from "./components/views/ClientView";
import { AgentView } from "./components/views/AgentView";
import { Leaderboard } from "./components/views/Leaderboard";
import { HistoricalAnalysis } from "./components/views/HistoricalAnalysis";
import { SettingsView } from "./components/views/SettingsView";
import { getDefaultDateRange } from "./lib/dateUtils";
import type { ViewType, FilterState, DateRange } from "./types";

const defaultDateRange = getDefaultDateRange();

const defaultFilters: FilterState = {
  dateRange: defaultDateRange,
  selectedClients: [],
  achievementTier: "all",
  searchQuery: "",
  timeFilter: "custom",
};

function App() {
  const [activeView, setActiveView] = useState<ViewType>("overview");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setFilters((f) => ({ ...f }));
  }, []);

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setFilters((f) => ({ ...f, dateRange: range }));
  }, []);

  const renderView = () => {
    switch (activeView) {
      case "overview":
        return <Overview key={refreshKey} dateRange={filters.dateRange} />;
      case "clients":
        return (
          <ClientView
            key={refreshKey}
            filters={filters}
            onFiltersChange={setFilters}
          />
        );
      case "agents":
        return (
          <AgentView
            key={refreshKey}
            filters={filters}
            onFiltersChange={setFilters}
          />
        );
      case "leaderboard":
        return (
          <Leaderboard
            key={refreshKey}
            filters={filters}
            onFiltersChange={setFilters}
          />
        );
      case "historical":
        return (
          <HistoricalAnalysis
            key={refreshKey}
            filters={filters}
            onFiltersChange={setFilters}
          />
        );
      case "settings":
        return <SettingsView key={refreshKey} />;
      default:
        return <Overview key={refreshKey} dateRange={filters.dateRange} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          currentView={activeView}
          onRefresh={handleRefresh}
          isConnected={true}
          dateRange={filters.dateRange}
          onDateRangeChange={handleDateRangeChange}
        />
        <main className="flex-1 overflow-y-auto">{renderView()}</main>
      </div>
    </div>
  );
}

export default App;
