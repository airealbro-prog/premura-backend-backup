import { useState, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { useAgents } from "@/hooks/useAgents";
import { FilterBar } from "@/components/layout/FilterBar";
import { ExpandableRow } from "@/components/shared/ExpandableRow";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { TruncatedName } from "@/components/shared/TruncatedName";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import type { FilterState, Client } from "@/types";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PerformanceViewProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
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
          setClientOptions(
            data.map((d: Pick<Client, "company_id" | "company_name">) => ({
              id: d.company_id,
              name: d.company_name,
            }))
          );
        }
      });
  }, []);

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
        transition={{ duration: 0.2 }}
      >
        {/* Toggle + Filters */}
        <div className="px-4 pt-4 flex items-center gap-4 flex-wrap">
          {/* Pill toggle */}
          <div className="relative flex items-center rounded-full p-1 bg-card border border-border">
            <motion.div
              layoutId="perf-toggle"
              className="absolute top-1 bottom-1 rounded-full"
              style={{
                width: "calc(50% - 4px)",
                background: "#8851F4",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              animate={{
                left: mode === "clients" ? "4px" : "calc(50%)",
              }}
            />
            <button
              onClick={() => setMode("clients")}
              className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${
                mode === "clients" ? "text-white" : "text-muted-foreground"
              }`}
            >
              Client Performance
            </button>
            <button
              onClick={() => setMode("agents")}
              className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${
                mode === "agents" ? "text-white" : "text-muted-foreground"
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
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : mode === "clients" ? (
          /* ── Client Performance ── */
          clients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No client data found. Ensure the <code>clients</code> table is populated.
            </div>
          ) : (
            <div className="glass-card mx-4 mb-4 overflow-hidden">
              <div className="grid grid-cols-7 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20">
                <div className="col-span-1 pl-8">Client</div>
                <div>Status</div>
                <div className="text-center">Seats</div>
                <div className="text-center">Agents</div>
                <div className="text-center">Appts</div>
                <div className="col-span-2">Achievement</div>
              </div>

              {clients.map((client) => (
                <ExpandableRow
                  key={client.companyId}
                  header={
                    <div className="grid grid-cols-7 gap-2 items-center py-2 pr-4">
                      <div className="col-span-1">
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-primary/15 text-foreground truncate max-w-[180px]">
                          <TruncatedName name={client.companyName} maxLen={20} />
                        </span>
                      </div>
                      <div>
                        <Badge
                          variant={
                            client.status === "active"
                              ? "success"
                              : client.status === "paused"
                              ? "warning"
                              : "destructive"
                          }
                        >
                          {client.status}
                        </Badge>
                      </div>
                      <div className="text-center text-sm font-semibold text-foreground tabular-nums">
                        {client.seatsPurchased}
                      </div>
                      <div className="text-center text-sm font-semibold text-foreground tabular-nums">
                        {client.activeAgents}
                      </div>
                      <div className="text-center text-sm font-semibold text-foreground tabular-nums">
                        {client.totalAppointments}
                      </div>
                      <div className="col-span-2">
                        <ProgressBar percentage={client.achievement} />
                      </div>
                    </div>
                  }
                >
                  {client.agents.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      No active agents in this campaign.
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-border">
                      <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/20">
                        <div>Agent</div>
                        <div className="text-center">Appointments</div>
                        <div className="text-center">Weekly Avg</div>
                        <div className="col-span-2">Achievement</div>
                      </div>
                      {client.agents.map((agent) => (
                        <div
                          key={agent.setterName}
                          className="grid grid-cols-5 gap-2 px-4 py-2.5 items-center border-t border-border hover:bg-muted/20 transition-colors"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {agent.setterName}
                          </div>
                          <div className="text-center text-sm font-semibold text-foreground tabular-nums">
                            {agent.appointmentsBooked}
                          </div>
                          <div className="text-center text-sm text-muted-foreground tabular-nums">
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
            <div className="p-8 text-center text-muted-foreground">
              No active agents found in the selected date range.
            </div>
          ) : (
            <div className="glass-card mx-4 mb-4 overflow-hidden">
              {agentsByClient.map((group) => (
                <ExpandableRow
                  key={group.companyId}
                  defaultExpanded
                  header={
                    <div className="py-3 pr-4">
                      <span
                        className="inline-block px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                        style={{
                          background: "rgba(136, 81, 244, 0.15)",
                        }}
                      >
                        <TruncatedName name={group.companyName} maxLen={20} />
                      </span>
                      <span className="ml-3 text-xs text-muted-foreground">
                        {group.agents.length} active agent{group.agents.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  }
                >
                  <div className="rounded-lg overflow-hidden border border-border">
                    <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
                      <div>Agent Name</div>
                      <div>Client</div>
                      <div className="text-center">Appointments</div>
                      <div className="text-center">Weekly Avg</div>
                      <div className="col-span-2">Achievement</div>
                    </div>

                    {group.agents.map((agent) => (
                      <div
                        key={agent.setterName}
                        className="grid grid-cols-6 gap-2 px-4 py-2.5 items-center border-t border-border hover:bg-muted/20 transition-colors"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {agent.setterName}
                        </div>
                        <div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-foreground truncate inline-block max-w-[120px]">
                            <TruncatedName name={agent.companyName} maxLen={15} />
                          </span>
                        </div>
                        <div className="text-center text-sm font-semibold text-foreground tabular-nums">
                          {agent.appointmentsBooked}
                        </div>
                        <div className="text-center text-sm text-muted-foreground tabular-nums">
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
      </motion.div>
    </TooltipProvider>
  );
}
