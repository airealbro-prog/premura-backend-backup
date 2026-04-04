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
  mobileMenuButton?: React.ReactNode;
  clientOptions?: { id: string; name: string }[];
  selectedCompanyId?: string;
  onCompanyChange?: (id: string) => void;
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
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md bg-elevated border border-border text-sm transition-all hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
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
              className="ml-0.5 text-muted-foreground hover:text-primary cursor-pointer"
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

export function TopBar({ currentView, onRefresh, isConnected, dateRange, onDateRangeChange, companyName, mobileMenuButton, clientOptions, selectedCompanyId, onCompanyChange }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border glass">
      <div className="flex items-center justify-between px-3 sm:px-6 h-14">
        <div className="flex items-center gap-2 min-w-0">
          {mobileMenuButton}
          <h1 className="text-sm sm:text-base font-semibold text-foreground tracking-wide flex items-center gap-2 min-w-0">
            <span className="shrink-0">{viewLabels[currentView]}</span>
            {companyName && (
              <span className="text-muted-foreground font-normal truncate hidden sm:inline">
                — {companyName}
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Client filter — only on Overview for non-client users */}
          {clientOptions && clientOptions.length > 0 && onCompanyChange && (
            <select
              value={selectedCompanyId ?? ""}
              onChange={(e) => onCompanyChange(e.target.value)}
              className="rounded-md border border-border bg-elevated text-foreground px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 max-w-[180px] hidden sm:block"
            >
              <option value="">All Clients</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {/* Date pickers — hidden on very small screens, shown from sm */}
          <div className="hidden sm:flex items-center gap-2">
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
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2">
            <span
              className="w-2 h-2 rounded-full live-pulse"
              style={{ background: isConnected ? "#8851F4" : "#ef4444" }}
            />
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
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
      </div>

      {/* Mobile date pickers — stacked below on small screens */}
      <div className="flex sm:hidden items-center gap-2 px-3 pb-2 flex-wrap">
        {clientOptions && clientOptions.length > 0 && onCompanyChange && (
          <select
            value={selectedCompanyId ?? ""}
            onChange={(e) => onCompanyChange(e.target.value)}
            className="rounded-md border border-border bg-elevated text-foreground px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 flex-1 min-w-0"
          >
            <option value="">All Clients</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
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
      </div>
    </header>
  );
}
