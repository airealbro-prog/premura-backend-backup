import { useState, useEffect } from "react";
import { useHistorical } from "@/hooks/useHistorical";
import type { HistoricalClientRow } from "@/hooks/useHistorical";
import { useAuth } from "@/lib/auth";
import { FilterBar } from "@/components/layout/FilterBar";
import { ExpandableRow } from "@/components/shared/ExpandableRow";
import { WeeklyChart } from "@/components/shared/WeeklyChart";
import { MonthlyChart } from "@/components/shared/MonthlyChart";
import { TruncatedName } from "@/components/shared/TruncatedName";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAchievementColor } from "@/lib/calculations";
import { supabase } from "@/lib/supabase";
import type { FilterState, Client } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

interface HistoricalAnalysisProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

export function HistoricalAnalysis({ filters, onFiltersChange }: HistoricalAnalysisProps) {
  const { userRole } = useAuth();
  const isClientUser = userRole?.role === "client" || (userRole as { role: string } | null)?.role === "client_admin";
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const { rows, periods, loading, error } = useHistorical(filters, viewMode);
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<HistoricalClientRow | null>(null);

  useEffect(() => {
    let query = supabase.from("clients").select("company_id, company_name").eq("is_test", false);
    if (isClientUser && userRole?.company_id) {
      query = query.eq("company_id", userRole.company_id);
    }
    query.then(({ data }) => {
      if (data) {
        setClientOptions(
          data.map((d: Pick<Client, "company_id" | "company_name">) => ({
            id: d.company_id,
            name: d.company_name,
          }))
        );
      }
    });
  }, [isClientUser, userRole]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        Error loading data: {error}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* View Mode Toggle */}
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-card rounded-lg border border-border p-1">
            <button
              onClick={() => setViewMode("weekly")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === "weekly"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Weekly View
            </button>
            <button
              onClick={() => setViewMode("monthly")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === "monthly"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly View
            </button>
          </div>

          <FilterBar
            filters={filters}
            onFiltersChange={onFiltersChange}
            clientOptions={isClientUser ? [] : clientOptions}
            showAchievementFilter={false}
            searchPlaceholder="Search agents..."
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No historical data available.
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <div className="glass-card overflow-x-auto">
              {/* Header */}
              <div className="flex items-center border-b border-border">
                <div className="w-[200px] shrink-0 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                  Client / Agent
                </div>
                {periods.map((p, i) => (
                  <div
                    key={i}
                    className="min-w-[100px] px-2 py-3 text-xs font-semibold text-muted-foreground text-center"
                  >
                    {p.label}
                  </div>
                ))}
              </div>

              {/* Client Rows */}
              {rows.map((row) => (
                <ExpandableRow
                  key={row.companyId}
                  header={
                    <div className="flex items-center">
                      <div
                        className="w-[200px] shrink-0 py-2 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClient(row);
                        }}
                      >
                        <TruncatedName
                          name={row.companyName}
                          maxLen={20}
                          className="text-sm font-medium text-primary hover:underline cursor-pointer"
                        />
                      </div>
                      {row.cells.map((cell, i) => (
                        <div
                          key={i}
                          className="min-w-[100px] px-2 py-2 text-center"
                          title={`${cell.count} appts | ${cell.achievement.toFixed(1)}% achievement`}
                        >
                          <span
                            className="inline-block px-3 py-1 rounded-md text-xs font-semibold tabular-nums"
                            style={{
                              background: `${getAchievementColor(cell.achievement)}20`,
                              color: getAchievementColor(cell.achievement),
                            }}
                          >
                            {cell.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  }
                >
                  {/* Agent sub-rows */}
                  {row.agents.map((agent) => (
                    <div
                      key={agent.setterName}
                      className="flex items-center border-t border-border/50"
                    >
                      <div
                        className="w-[180px] shrink-0 px-4 py-2 text-sm text-muted-foreground truncate"
                        title={agent.setterName}
                      >
                        {agent.setterName}
                      </div>
                      {agent.cells.map((cell, i) => (
                        <div
                          key={i}
                          className="min-w-[100px] px-2 py-2 text-center"
                          title={`${cell.count} appts | ${cell.achievement.toFixed(1)}% achievement`}
                        >
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs tabular-nums"
                            style={{
                              background: `${getAchievementColor(cell.achievement)}15`,
                              color: getAchievementColor(cell.achievement),
                            }}
                          >
                            {cell.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </ExpandableRow>
              ))}
            </div>
          </div>
        )}

        {/* Slide-over Panel */}
        <AnimatePresence>
          {selectedClient && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedClient(null)}
              />
              <motion.div
                className="fixed top-0 right-0 h-full w-full sm:w-[480px] sm:max-w-full bg-card border-l border-border z-50 overflow-y-auto shadow-2xl"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-primary">
                      {selectedClient.companyName}
                    </h2>
                    <button
                      onClick={() => setSelectedClient(null)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Client Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="glass-card p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-1">
                        Seats
                      </div>
                      <div className="text-2xl font-bold text-foreground tabular-nums">
                        {selectedClient.seatsPurchased}
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-1">
                        Active Agents
                      </div>
                      <div className="text-2xl font-bold text-foreground tabular-nums">
                        {selectedClient.agents.length}
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                      Appointments Over Time
                    </h3>
                    <div className="glass-card p-4">
                      {viewMode === "weekly" ? (
                        <WeeklyChart
                          data={periods.map((p, i) => ({
                            label: p.label,
                            appointments: selectedClient.cells[i]?.count ?? 0,
                          }))}
                        />
                      ) : (
                        <MonthlyChart
                          data={periods.map((p, i) => ({
                            label: p.label,
                            appointments: selectedClient.cells[i]?.count ?? 0,
                          }))}
                        />
                      )}
                    </div>
                  </div>

                  {/* Agent Breakdown */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                      Agent Breakdown
                    </h3>
                    <div className="flex flex-col gap-2">
                      {selectedClient.agents.map((agent) => {
                        const totalAppts = agent.cells.reduce(
                          (s, c) => s + c.count,
                          0
                        );
                        return (
                          <div
                            key={agent.setterName}
                            className="glass-card p-3 flex items-center justify-between"
                          >
                            <span className="text-sm font-medium text-foreground">
                              {agent.setterName}
                            </span>
                            <span className="text-sm tabular-nums text-primary font-semibold">
                              {totalAppts} appts
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
}
