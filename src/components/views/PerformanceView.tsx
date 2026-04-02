import { useState, useEffect } from "react";
import { useClients } from "../../hooks/useClients";
import { useAgents } from "../../hooks/useAgents";
import { FilterBar } from "../layout/FilterBar";
import { ExpandableRow } from "../shared/ExpandableRow";
import { ProgressBar } from "../shared/ProgressBar";
import { supabase } from "../../lib/supabase";
import type { FilterState, Client } from "../../types";
import { Loader2 } from "lucide-react";

interface PerformanceViewProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

function TruncatedName({ name, maxLen = 20 }: { name: string; maxLen?: number }) {
  const truncated = name.length > maxLen ? name.slice(0, maxLen) + "\u2026" : name;
  return (
    <span title={name.length > maxLen ? name : undefined}>{truncated}</span>
  );
}

export function PerformanceView({ filters, onFiltersChange }: PerformanceViewProps) {
  const [mode, setMode] = useState<"clients" | "agents">("clients");
  const { clients, loading: clientsLoading, error: clientsError } = useClients(filters);
  const { agentsByClient, loading: agentsLoading, error: agentsError } = useAgents(filters);
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);

  const loading = mode === "clients" ? clientsLoading : agentsLoading;
  const error = mode === "clients" ? clientsError : agentsError;

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
      {/* Toggle + Filters */}
      <div className="px-4 pt-4 flex items-center gap-4 flex-wrap">
        {/* Pill toggle */}
        <div
          className="relative flex items-center rounded-full p-1 cursor-pointer select-none"
          style={{ background: "rgba(123,47,247,0.15)", border: "1px solid rgba(0,212,255,0.2)" }}
        >
          <div
            className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-in-out"
            style={{
              width: "calc(50% - 4px)",
              left: mode === "clients" ? "4px" : "calc(50%)",
              background: "linear-gradient(135deg, #7b2ff7, #00d4ff)",
            }}
          />
          <button
            onClick={() => setMode("clients")}
            className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${
              mode === "clients" ? "text-white" : "text-text-secondary"
            }`}
          >
            Client Performance
          </button>
          <button
            onClick={() => setMode("agents")}
            className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${
              mode === "agents" ? "text-white" : "text-text-secondary"
            }`}
          >
            Agent Performance
          </button>
        </div>

        <FilterBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          clientOptions={clientOptions}
          searchPlaceholder={mode === "clients" ? "Search clients..." : "Search agents..."}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-accent-cyan" />
        </div>
      ) : mode === "clients" ? (
        /* ── Client Performance ── */
        clients.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No client data found. Ensure the <code>clients</code> table is populated.
          </div>
        ) : (
          <div className="card mx-4 mb-4 overflow-hidden">
            <div className="grid grid-cols-7 gap-2 px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle bg-bg-elevated/50">
              <div className="col-span-1 pl-8">Client</div>
              <div>Status</div>
              <div className="text-center">Seats</div>
              <div className="text-center">Active Agents</div>
              <div className="text-center">Appointments</div>
              <div className="col-span-2">Achievement</div>
            </div>

            {clients.map((client) => (
              <ExpandableRow
                key={client.companyId}
                header={
                  <div className="grid grid-cols-7 gap-2 items-center py-2 pr-4">
                    <div className="col-span-1">
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-accent-purple/20 text-accent-cyan truncate max-w-[180px]" title={client.companyName}>
                        <TruncatedName name={client.companyName} />
                      </span>
                    </div>
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.status === "active"
                            ? "bg-tier-green/20 text-tier-green"
                            : client.status === "paused"
                            ? "bg-tier-yellow/20 text-tier-yellow"
                            : "bg-tier-red/20 text-tier-red"
                        }`}
                      >
                        {client.status}
                      </span>
                    </div>
                    <div className="text-center text-sm font-semibold tabular-nums">
                      {client.seatsPurchased}
                    </div>
                    <div className="text-center text-sm font-semibold tabular-nums">
                      {client.activeAgents}
                    </div>
                    <div className="text-center text-sm font-semibold tabular-nums">
                      {client.totalAppointments}
                    </div>
                    <div className="col-span-2">
                      <ProgressBar percentage={client.achievement} />
                    </div>
                  </div>
                }
              >
                {client.agents.length === 0 ? (
                  <div className="text-sm text-text-secondary py-2">
                    No active agents in this campaign.
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden border border-border-subtle">
                    <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-semibold text-text-secondary uppercase bg-bg-elevated/30">
                      <div>Agent</div>
                      <div className="text-center">Appointments</div>
                      <div className="text-center">Weekly Avg</div>
                      <div className="col-span-2">Achievement</div>
                    </div>
                    {client.agents.map((agent) => (
                      <div
                        key={agent.setterName}
                        className="grid grid-cols-5 gap-2 px-4 py-2.5 items-center border-t border-border-subtle hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="text-sm font-medium text-text-primary">
                          {agent.setterName}
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
                      </div>
                    ))}
                  </div>
                )}
              </ExpandableRow>
            ))}
          </div>
        )
      ) : (
        /* ── Agent Performance ── */
        agentsByClient.length === 0 ? (
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
                      <TruncatedName name={group.companyName} />
                    </span>
                    <span className="ml-3 text-xs text-text-secondary">
                      {group.agents.length} active agent{group.agents.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                }
              >
                <div className="rounded-lg overflow-hidden border border-border-subtle">
                  <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider bg-bg-elevated/30">
                    <div>Agent Name</div>
                    <div>Client</div>
                    <div className="text-center">Appointments</div>
                    <div className="text-center">Weekly Avg</div>
                    <div className="col-span-2">Achievement</div>
                  </div>

                  {group.agents.map((agent) => (
                    <div
                      key={agent.setterName}
                      className="grid grid-cols-6 gap-2 px-4 py-2.5 items-center border-t border-border-subtle hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="text-sm font-medium text-text-primary">
                        {agent.setterName}
                      </div>
                      <div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-cyan truncate inline-block max-w-[120px]" title={agent.companyName}>
                          <TruncatedName name={agent.companyName} maxLen={15} />
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
                    </div>
                  ))}
                </div>
              </ExpandableRow>
            ))}
          </div>
        )
      )}
    </div>
  );
}
