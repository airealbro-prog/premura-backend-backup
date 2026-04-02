import { useState, useEffect } from "react";
import { useLeaderboard } from "../../hooks/useLeaderboard";
import { FilterBar } from "../layout/FilterBar";
import { LeaderboardCard } from "../shared/LeaderboardCard";
import { supabase } from "../../lib/supabase";
import type { FilterState, TimeFilter, Client } from "../../types";
import { Loader2, Trophy, Users } from "lucide-react";

interface LeaderboardProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

export function Leaderboard({ filters, onFiltersChange }: LeaderboardProps) {
  const { topClients, topAgents, loading, error } = useLeaderboard(filters);
  const [activeTab, setActiveTab] = useState<"clients" | "agents">("clients");
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase
      .from("clients")
      .select("company_id, company_name")
      .then(({ data }) => {
        if (data) {
          setClientOptions(data.map((d: Pick<Client, "company_id" | "company_name">) => ({ id: d.company_id, name: d.company_name })));
        }
      });
  }, []);

  const timeFilterOptions: { value: TimeFilter; label: string }[] = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom" },
  ];

  if (error) {
    return (
      <div className="p-8 text-center text-tier-red">
        Error loading data: {error}
      </div>
    );
  }

  return (
    <div>
      {/* Time Filter Tabs */}
      <div className="px-4 pt-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-bg-surface rounded-lg border border-border-subtle p-1">
          {timeFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onFiltersChange({ ...filters, timeFilter: opt.value })
              }
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                filters.timeFilter === opt.value
                  ? "gradient-bg text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filters.timeFilter === "custom" && (
          <span className="text-xs text-text-secondary">
            Uses the global date range from the top bar
          </span>
        )}

        <FilterBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          clientOptions={clientOptions}
          showAchievementFilter={false}
          showSearch={false}
        />
      </div>

      {/* Tab Switcher */}
      <div className="px-4 pt-4 flex gap-2">
        <button
          onClick={() => setActiveTab("clients")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === "clients"
              ? "gradient-bg text-white"
              : "bg-bg-surface text-text-secondary border border-border-subtle hover:text-text-primary"
          }`}
        >
          <Trophy size={16} />
          Top Clients
        </button>
        <button
          onClick={() => setActiveTab("agents")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === "agents"
              ? "gradient-bg text-white"
              : "bg-bg-surface text-text-secondary border border-border-subtle hover:text-text-primary"
          }`}
        >
          <Users size={16} />
          Top Agents
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-accent-cyan" />
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {activeTab === "clients" ? (
            topClients.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">No client data available.</div>
            ) : (
              topClients.map((entry) => (
                <LeaderboardCard
                  key={entry.name}
                  entry={entry}
                  isTopThree={entry.rank <= 3}
                />
              ))
            )
          ) : topAgents.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">No agent data available.</div>
          ) : (
            topAgents.map((entry) => (
              <LeaderboardCard
                key={`${entry.name}-${entry.companyName}`}
                entry={entry}
                isTopThree={entry.rank <= 3}
                showCompany
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
