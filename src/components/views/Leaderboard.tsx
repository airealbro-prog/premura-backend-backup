import { useState, useEffect, useMemo } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { FilterBar } from "@/components/layout/FilterBar";
import { LeaderboardCard } from "@/components/shared/LeaderboardCard";
import { supabase } from "@/lib/supabase";
import type { FilterState, TimeFilter, Client } from "@/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { Loader2, Trophy, Users, AlertTriangle } from "lucide-react";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { getAchievementColor } from "@/lib/calculations";

interface LeaderboardProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

export function Leaderboard({ filters, onFiltersChange }: LeaderboardProps) {
  const { topClients, topAgents, loading, error } = useLeaderboard(filters);
  const [activeTab, setActiveTab] = useState<"clients" | "agents" | "underperforming">("clients");
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

  // Clients sorted worst to best (ascending achievement)
  const underperformingClients = useMemo(() => {
    return [...topClients].sort((a, b) => a.achievement - b.achievement);
  }, [topClients]);

  const timeFilterOptions: { value: TimeFilter; label: string }[] = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom" },
  ];

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading data: {error}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Time Filter Tabs */}
        <div className="px-4 pt-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-card rounded-lg border border-border p-1">
            {timeFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  onFiltersChange({ ...filters, timeFilter: opt.value })
                }
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  filters.timeFilter === opt.value
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filters.timeFilter === "custom" && (
            <span className="text-xs text-muted-foreground">
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
                ? "bg-primary text-white"
                : "bg-card text-muted-foreground border border-border hover:text-foreground"
            }`}
          >
            <Trophy size={16} />
            Top Clients
          </button>
          <button
            onClick={() => setActiveTab("agents")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "agents"
                ? "bg-primary text-white"
                : "bg-card text-muted-foreground border border-border hover:text-foreground"
            }`}
          >
            <Users size={16} />
            Top Agents
          </button>
          <button
            onClick={() => setActiveTab("underperforming")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "underperforming"
                ? "bg-red-500 text-white"
                : "bg-card text-muted-foreground border border-border hover:text-foreground"
            }`}
          >
            <AlertTriangle size={16} />
            Needs Attention
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            {activeTab === "clients" ? (
              topClients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No client data available.</div>
              ) : (
                topClients.map((entry) => (
                  <LeaderboardCard
                    key={entry.name}
                    entry={entry}
                    isTopThree={entry.rank <= 3}
                  />
                ))
              )
            ) : activeTab === "agents" ? (
              topAgents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No agent data available.</div>
              ) : (
                topAgents.map((entry) => (
                  <LeaderboardCard
                    key={`${entry.name}-${entry.companyName}`}
                    entry={entry}
                    isTopThree={entry.rank <= 3}
                    showCompany
                  />
                ))
              )
            ) : underperformingClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No client data available.</div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-1">
                  Clients sorted by lowest achievement first. Focus resources on red and orange clients.
                </p>
                {underperformingClients.map((entry, idx) => {
                  const color = getAchievementColor(entry.achievement);
                  const isBottom = entry.achievement < 30;
                  return (
                    <div
                      key={entry.name}
                      className="glass-card p-4 flex items-center gap-4"
                      style={isBottom ? { borderLeft: `3px solid #ef4444` } : undefined}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: color }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate">{entry.name}</div>
                        {isBottom && (
                          <span className="text-xs text-red-400 font-medium">Critically underperforming</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Appts</div>
                          <div className="font-semibold tabular-nums">{entry.appointments}</div>
                        </div>
                        {entry.seats !== undefined && (
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Seats</div>
                            <div className="font-semibold tabular-nums">{entry.seats}</div>
                          </div>
                        )}
                        <div className="w-32">
                          <ProgressBar percentage={entry.achievement} height={8} />
                        </div>
                        <div className="text-right min-w-[50px]">
                          <span className="text-sm font-bold tabular-nums" style={{ color }}>
                            {entry.achievement.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
