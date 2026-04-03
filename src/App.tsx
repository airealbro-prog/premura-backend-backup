import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Overview } from "@/components/views/Overview";
import { PerformanceView } from "@/components/views/PerformanceView";
import { Leaderboard } from "@/components/views/Leaderboard";
import { HistoricalAnalysis } from "@/components/views/HistoricalAnalysis";
import { SettingsView } from "@/components/views/SettingsView";
import { getDefaultDateRange } from "@/lib/dateUtils";
import type { ViewType, FilterState, DateRange } from "@/types";

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
          <PerformanceView
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
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          currentView={activeView}
          onRefresh={handleRefresh}
          isConnected={true}
          dateRange={filters.dateRange}
          onDateRangeChange={handleDateRangeChange}
        />
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
