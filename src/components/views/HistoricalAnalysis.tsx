import { useState, useEffect } from "react";
import { useHistorical } from "../../hooks/useHistorical";
import type { HistoricalClientRow } from "../../hooks/useHistorical";
import { FilterBar } from "../layout/FilterBar";
import { ExpandableRow } from "../shared/ExpandableRow";
import { WeeklyChart } from "../shared/WeeklyChart";
import { MonthlyChart } from "../shared/MonthlyChart";
import { getAchievementColor } from "../../lib/calculations";
import { supabase } from "../../lib/supabase";
import type { FilterState, Client } from "../../types";
import { Loader2, X } from "lucide-react";

interface HistoricalAnalysisProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

export function HistoricalAnalysis({ filters, onFiltersChange }: HistoricalAnalysisProps) {
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const { rows, periods, loading, error } = useHistorical(filters, viewMode);
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<HistoricalClientRow | null>(null);

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

  if (error) {
    return (
      <div className="p-8 text-center text-tier-red">
        Error loading data: {error}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* View Mode Toggle */}
      <div className="px-4 pt-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-bg-surface rounded-lg border border-border-subtle p-1">
          <button
            onClick={() => setViewMode("weekly")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              viewMode === "weekly"
                ? "gradient-bg text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Weekly View
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              viewMode === "monthly"
                ? "gradient-bg text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Monthly View
          </button>
        </div>

        <FilterBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          clientOptions={clientOptions}
          showAchievementFilter={false}
          searchPlaceholder="Search agents..."
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-accent-cyan" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-text-secondary">No historical data available.</div>
      ) : (
        <div className="p-4">
          <div className="card overflow-x-auto">
            {/* Header */}
            <div className="flex items-center border-b border-border-subtle">
              <div className="w-[200px] shrink-0 px-4 py-3 text-xs font-semibold text-text-secondary uppercase">
                Client / Agent
              </div>
              {periods.map((p, i) => (
                <div
                  key={i}
                  className="min-w-[100px] px-2 py-3 text-xs font-semibold text-text-secondary text-center"
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
                      className="w-[180px] shrink-0 py-2 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClient(row);
                      }}
                    >
                      <span className="text-sm font-medium text-accent-cyan hover:underline truncate block" title={row.companyName}>
                        {row.companyName.length > 20 ? row.companyName.slice(0, 20) + "\u2026" : row.companyName}
                      </span>
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
                  <div key={agent.setterName} className="flex items-center border-t border-border-subtle/50">
                    <div className="w-[180px] shrink-0 px-4 py-2 text-sm text-text-secondary truncate" title={agent.setterName}>
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
      {selectedClient && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setSelectedClient(null)}
          />
          <div className="fixed top-0 right-0 h-full w-[480px] max-w-full bg-bg-surface border-l border-border-subtle z-50 overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold gradient-text">
                  {selectedClient.companyName}
                </h2>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-2 rounded-lg hover:bg-white/[0.05] text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Client Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="card-elevated p-4">
                  <div className="text-xs text-text-secondary uppercase mb-1">Seats</div>
                  <div className="text-2xl font-bold tabular-nums">{selectedClient.seatsPurchased}</div>
                </div>
                <div className="card-elevated p-4">
                  <div className="text-xs text-text-secondary uppercase mb-1">Active Agents</div>
                  <div className="text-2xl font-bold tabular-nums">{selectedClient.agents.length}</div>
                </div>
              </div>

              {/* Chart */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-secondary uppercase mb-3">
                  Appointments Over Time
                </h3>
                <div className="card-elevated p-4">
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
                <h3 className="text-sm font-semibold text-text-secondary uppercase mb-3">
                  Agent Breakdown
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedClient.agents.map((agent) => {
                    const totalAppts = agent.cells.reduce((s, c) => s + c.count, 0);
                    return (
                      <div key={agent.setterName} className="card-elevated p-3 flex items-center justify-between">
                        <span className="text-sm font-medium">{agent.setterName}</span>
                        <span className="text-sm tabular-nums text-accent-cyan font-semibold">
                          {totalAppts} appts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
