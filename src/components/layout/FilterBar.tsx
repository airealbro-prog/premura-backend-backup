import { Search, Filter, X } from "lucide-react";
import type { AchievementTier, FilterState } from "@/types";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  clientOptions: { id: string; name: string }[];
  showAchievementFilter?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

const tierOptions: { value: AchievementTier; label: string; color: string }[] = [
  { value: "all", label: "All", color: "#9ca3af" },
  { value: "blue", label: ">100%", color: "#00d4ff" },
  { value: "green", label: "85–100%", color: "#22c55e" },
  { value: "yellow", label: "60–84%", color: "#eab308" },
  { value: "red", label: "<60%", color: "#ef4444" },
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
    <div className="flex flex-wrap items-center gap-2 p-4">
      {/* Search */}
      {showSearch && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="pl-8 pr-8 py-2 text-sm rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors w-52"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFiltersChange({ ...filters, searchQuery: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Client Select */}
      <div className="relative">
        <select
          value={filters.selectedClients[0] ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onFiltersChange({ ...filters, selectedClients: val ? [val] : [] });
          }}
          className="pl-3 pr-8 py-2 text-sm rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer min-w-[150px]"
        >
          <option value="">All Clients</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>

      {/* Achievement Tier */}
      {showAchievementFilter && (
        <div className="flex items-center gap-0.5 bg-card rounded-md border border-border p-0.5">
          {tierOptions.map((tier) => (
            <button
              key={tier.value}
              onClick={() => onFiltersChange({ ...filters, achievementTier: tier.value })}
              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-all duration-150 ${
                filters.achievementTier === tier.value
                  ? ""
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                filters.achievementTier === tier.value
                  ? { background: `${tier.color}20`, color: tier.color }
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
