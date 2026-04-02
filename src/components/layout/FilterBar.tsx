import { Search, Filter, X } from "lucide-react";
import type { AchievementTier, FilterState } from "../../types";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  clientOptions: { id: string; name: string }[];
  showAchievementFilter?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

const tierOptions: { value: AchievementTier; label: string; color: string }[] = [
  { value: "all", label: "All Tiers", color: "#94a3b8" },
  { value: "blue", label: "Above 100%", color: "#00d4ff" },
  { value: "green", label: "85\u2013100%", color: "#22c55e" },
  { value: "yellow", label: "60\u201384%", color: "#eab308" },
  { value: "red", label: "Below 60%", color: "#ef4444" },
];

export function FilterBar({
  filters,
  onFiltersChange,
  clientOptions,
  showAchievementFilter = true,
  showSearch = true,
  searchPlaceholder = "Search...",
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      {/* Search */}
      {showSearch && (
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={filters.searchQuery}
            onChange={(e) =>
              onFiltersChange({ ...filters, searchQuery: e.target.value })
            }
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-border-subtle bg-bg-surface text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-cyan/40 transition-colors w-56"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFiltersChange({ ...filters, searchQuery: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent-cyan"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Client Multi-Select */}
      <div className="relative">
        <select
          value={filters.selectedClients[0] ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onFiltersChange({
              ...filters,
              selectedClients: val ? [val] : [],
            });
          }}
          className="pl-3 pr-8 py-2 text-sm rounded-lg border border-border-subtle bg-bg-surface text-text-primary focus:outline-none focus:border-accent-cyan/40 appearance-none cursor-pointer min-w-[160px]"
        >
          <option value="">All Clients</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Filter
          size={12}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
      </div>

      {/* Achievement Tier */}
      {showAchievementFilter && (
        <div className="flex items-center gap-1 bg-bg-surface rounded-lg border border-border-subtle p-1">
          {tierOptions.map((tier) => (
            <button
              key={tier.value}
              onClick={() =>
                onFiltersChange({ ...filters, achievementTier: tier.value })
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                filters.achievementTier === tier.value
                  ? "text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              style={
                filters.achievementTier === tier.value
                  ? {
                      background: `${tier.color}30`,
                      color: tier.color,
                    }
                  : undefined
              }
            >
              {tier.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
