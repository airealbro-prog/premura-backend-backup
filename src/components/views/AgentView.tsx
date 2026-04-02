import { useState, useEffect } from "react";
import { useAgents } from "../../hooks/useAgents";
import { FilterBar } from "../layout/FilterBar";
import { ExpandableRow } from "../shared/ExpandableRow";
import { ProgressBar } from "../shared/ProgressBar";
import { supabase } from "../../lib/supabase";
import type { FilterState, Client } from "../../types";
import { Loader2 } from "lucide-react";

interface AgentViewProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

export function AgentView({ filters, onFiltersChange }: AgentViewProps) {
  const { agentsByClient, loading, error } = useAgents(filters);
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

  if (error) {
    return (
      <div className="p-8 text-center text-tier-red">
        Error loading data: {error}
      </div>
    );
  }

  return (
    <div>
      <FilterBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        clientOptions={clientOptions}
        searchPlaceholder="Search agents..."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-accent-cyan" />
        </div>
      ) : agentsByClient.length === 0 ? (
        <div className="p-8 text-center text-text-secondary">
          No active agents found in the selected date range.
        </div>
      ) : (
        <div className="card mx-4 mb-4 overflow-hidden">
          {agentsByClient.map((group) => (
            <ExpandableRow
              key={group.companyId}
              defaultExpanded
              header={
                <div className="py-3 pr-4">
                  <span
                    className="inline-block px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                    style={{
                      background: "linear-gradient(135deg, rgba(123,47,247,0.5), rgba(0,212,255,0.3))",
                    }}
                  >
                    {group.companyName}
                  </span>
                  <span className="ml-3 text-xs text-text-secondary">
                    {group.agents.length} active agent{group.agents.length !== 1 ? "s" : ""}
                  </span>
                </div>
              }
            >
              <div className="rounded-lg overflow-hidden border border-border-subtle">
                {/* Agent Table Header */}
                <div className="grid grid-cols-7 gap-2 px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider bg-bg-elevated/30">
                  <div>Agent Name</div>
                  <div>Client</div>
                  <div className="text-center">Appointments</div>
                  <div className="text-center">Weekly Avg</div>
                  <div className="col-span-2">Achievement</div>
                  <div className="text-center">Leads</div>
                </div>

                {group.agents.map((agent) => (
                  <div
                    key={agent.setterName}
                    className="grid grid-cols-7 gap-2 px-4 py-2.5 items-center border-t border-border-subtle hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="text-sm font-medium text-text-primary">
                      {agent.setterName}
                    </div>
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-cyan">
                        {agent.companyName}
                      </span>
                    </div>
                    <div className="text-center text-sm font-semibold tabular-nums">
                      {agent.appointmentsBooked}
                    </div>
                    <div className="text-center text-sm tabular-nums">
                      {agent.weeklyAvg.toFixed(1)}
                    </div>
                    <div className="col-span-2">
                      <ProgressBar percentage={agent.achievement} height={6} />
                    </div>
                    <div className="text-center text-sm tabular-nums">
                      {agent.totalLeads}
                    </div>
                  </div>
                ))}
              </div>
            </ExpandableRow>
          ))}
        </div>
      )}
    </div>
  );
}
