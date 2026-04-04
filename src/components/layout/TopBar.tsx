import { useState } from "react";
import { RefreshCw, X, Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";
import type { ViewType, DateRange } from "@/types";
import { toInputDate } from "@/lib/dateUtils";
import "react-day-picker/style.css";

interface TopBarProps {
  currentView: ViewType;
  onRefresh: () => void;
  isConnected: boolean;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  companyName?: string | null;
}

const viewLabels: Record<ViewType, string> = {
  overview: "Overview",
  clients: "Performance",
  leaderboard: "Leaderboard",
  historical: "Historical Analysis",
  leads: "Leads Management",
  settings: "Settings",
};

function DatePickerPopover({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-elevated border border-border text-sm transition-all hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <Calendar size={13} className="text-primary shrink-0" />
          <span className="text-muted-foreground text-xs font-medium">{label}</span>
          <span className="text-foreground text-xs tabular-nums">
            {value ? toInputDate(value) : "All"}
          </span>
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-1 text-muted-foreground hover:text-primary cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-50 rounded-lg border border-border bg-card p-3 shadow-xl"
        >
          <DayPicker
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => {
              if (d) {
                onChange(d);
                setOpen(false);
              }
            }}
            defaultMonth={value ?? new Date()}
          />
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TopBar({ currentView, onRefresh, isConnected, dateRange, onDateRangeChange, companyName }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-border glass">
      <h1 className="text-base font-semibold text-foreground tracking-wide flex items-center gap-2">
        {viewLabels[currentView]}
        {companyName && (
          <span className="text-muted-foreground font-normal">
            — {companyName}
          </span>
        )}
      </h1>

      <div className="flex items-center gap-3">
        {/* Date pickers */}
        <DatePickerPopover
          label="From"
          value={dateRange.start}
          onChange={(d) => {
            d.setHours(0, 0, 0, 0);
            onDateRangeChange({ ...dateRange, start: d });
          }}
          onClear={() => onDateRangeChange({ ...dateRange, start: null })}
        />
        <DatePickerPopover
          label="To"
          value={dateRange.end}
          onChange={(d) => {
            d.setHours(23, 59, 59, 999);
            onDateRangeChange({ ...dateRange, end: d });
          }}
          onClear={() => onDateRangeChange({ ...dateRange, end: null })}
        />

        {/* Live indicator */}
        <div className="flex items-center gap-2 ml-2">
          <span
            className="w-2 h-2 rounded-full live-pulse"
            style={{ background: isConnected ? "#8851F4" : "#ef4444" }}
          />
          <span className="text-xs text-muted-foreground font-medium">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors"
          title="Refresh data"
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </header>
  );
}
