import { useRef } from "react";
import { RefreshCw, X, Calendar } from "lucide-react";
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
  clients: "Performance",
  leaderboard: "Leaderboard",
  historical: "Historical Analysis",
  settings: "Settings",
};

export function TopBar({ currentView, onRefresh, isConnected, dateRange, onDateRangeChange }: TopBarProps) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  return (
    <header
      className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-border-subtle glassmorphism"
    >
      <h1 className="text-lg font-semibold text-text-primary tracking-wide">
        {viewLabels[currentView]}
      </h1>

      <div className="flex items-center gap-4">
        {/* Date Range Pickers */}
        <div className="flex items-center gap-3">
          {/* From date */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:border-accent-cyan/40"
            style={{
              background: "#0f3460",
              border: "1px solid rgba(0,212,255,0.15)",
            }}
            onClick={() => fromRef.current?.showPicker?.()}
          >
            <Calendar size={12} className="text-accent-cyan shrink-0" />
            <span className="text-xs text-text-secondary font-medium">From</span>
            <input
              ref={fromRef}
              type="date"
              value={toInputDate(dateRange.start)}
              onChange={(e) => {
                const val = e.target.value;
                onDateRangeChange({
                  ...dateRange,
                  start: val ? new Date(val + "T00:00:00") : null,
                });
              }}
              className="date-picker-dark w-[110px]"
            />
            {dateRange.start && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDateRangeChange({ ...dateRange, start: null });
                }}
                className="text-text-secondary hover:text-accent-cyan transition-colors"
                title="Clear — show all from beginning"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* To date */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:border-accent-cyan/40"
            style={{
              background: "#0f3460",
              border: "1px solid rgba(0,212,255,0.15)",
            }}
            onClick={() => toRef.current?.showPicker?.()}
          >
            <Calendar size={12} className="text-accent-cyan shrink-0" />
            <span className="text-xs text-text-secondary font-medium">To</span>
            <input
              ref={toRef}
              type="date"
              value={toInputDate(dateRange.end)}
              onChange={(e) => {
                const val = e.target.value;
                onDateRangeChange({
                  ...dateRange,
                  end: val ? new Date(val + "T23:59:59") : null,
                });
              }}
              className="date-picker-dark w-[110px]"
            />
            {dateRange.end && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDateRangeChange({ ...dateRange, end: null });
                }}
                className="text-text-secondary hover:text-accent-cyan transition-colors"
                title="Clear — show all to today"
              >
                <X size={12} />
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
