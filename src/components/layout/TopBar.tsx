import { RefreshCw, X } from "lucide-react";
import type { ViewType, DateRange } from "../../types";
import { toInputDate } from "../../lib/dateUtils";

interface TopBarProps {
  currentView: ViewType;
  onRefresh: () => void;
  isConnected: boolean;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const viewLabels: Record<ViewType, string> = {
  overview: "Overview",
  clients: "Client Campaign View",
  agents: "Agent Performance View",
  leaderboard: "Leaderboard",
  historical: "Historical Analysis",
  settings: "Settings",
};

export function TopBar({ currentView, onRefresh, isConnected, dateRange, onDateRangeChange }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-border-subtle glassmorphism"
    >
      <h1 className="text-lg font-semibold text-text-primary tracking-wide">
        {viewLabels[currentView]}
      </h1>

      <div className="flex items-center gap-4">
        {/* Date Range Pickers */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary font-medium">From</label>
          <div className="relative">
            <input
              type="date"
              value={toInputDate(dateRange.start)}
              onChange={(e) => {
                const val = e.target.value;
                onDateRangeChange({
                  ...dateRange,
                  start: val ? new Date(val + "T00:00:00") : null,
                });
              }}
              className="px-2 py-1 pr-7 text-xs rounded-md border border-border-subtle bg-bg-surface text-text-primary focus:outline-none focus:border-accent-cyan/40"
            />
            {dateRange.start && (
              <button
                onClick={() => onDateRangeChange({ ...dateRange, start: null })}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent-cyan p-0.5"
                title="Clear — show all from beginning"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <label className="text-xs text-text-secondary font-medium">To</label>
          <div className="relative">
            <input
              type="date"
              value={toInputDate(dateRange.end)}
              onChange={(e) => {
                const val = e.target.value;
                onDateRangeChange({
                  ...dateRange,
                  end: val ? new Date(val + "T23:59:59") : null,
                });
              }}
              className="px-2 py-1 pr-7 text-xs rounded-md border border-border-subtle bg-bg-surface text-text-primary focus:outline-none focus:border-accent-cyan/40"
            />
            {dateRange.end && (
              <button
                onClick={() => onDateRangeChange({ ...dateRange, end: null })}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent-cyan p-0.5"
                title="Clear — show all to today"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full live-pulse"
            style={{
              background: isConnected ? "#00d4ff" : "#ef4444",
            }}
          />
          <span className="text-xs text-text-secondary font-medium">
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-text-secondary hover:text-accent-cyan hover:bg-white/[0.05] transition-all duration-200"
          title="Refresh data"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </header>
  );
}
