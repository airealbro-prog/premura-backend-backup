import { useState, useEffect, useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useAgents } from "@/hooks/useAgents";
import { useAuth } from "@/lib/auth";
import { FilterBar } from "@/components/layout/FilterBar";
import { ExpandableRow } from "@/components/shared/ExpandableRow";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { TruncatedName } from "@/components/shared/TruncatedName";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import type { FilterState, Client } from "@/types";
import { motion } from "framer-motion";
import { Loader2, ChevronUp, ChevronDown } from "lucide-react";

interface PerformanceViewProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

type SortField = "setterName" | "companyName" | "appointmentsBooked" | "weeklyAvg" | "achievement";
type SortDir = "asc" | "desc";

interface FlatAgent {
  setterName: string;
  companyId: string;
  companyName: string;
  appointmentsBooked: number;
  weeklyAvg: number;
  achievement: number;
}

function SortArrow({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) {
    return (
      <span className="inline-flex flex-col ml-1 opacity-30">
        <ChevronUp size={10} />
        <ChevronDown size={10} className="-mt-1" />
      </span>
    );
  }
  return (
    <span className="inline-flex ml-1">
      {sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </span>
  );
}

export function PerformanceView({ filters, onFiltersChange }: PerformanceViewProps) {
  const { userRole } = useAuth();
  const isClientUser = userRole?.role === "client" || (userRole as { role: string } | null)?.role === "client_admin";

  const [mode, setMode] = useState<"clients" | "agents">(isClientUser ? "agents" : "clients");
  const { clients, loading: clientsLoading, error: clientsError } = useClients(filters);
  const { agentsByClient, loading: agentsLoading, error: agentsError } = useAgents(filters);
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);

  // Sort state for agent table
  const [sortField, setSortField] = useState<SortField>("setterName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const loading = mode === "clients" ? clientsLoading : agentsLoading;
  const error = mode === "clients" ? clientsError : agentsError;

  // Force agents mode for client users
  useEffect(() => {
    if (isClientUser && mode !== "agents") {
      setMode("agents");
    }
  }, [isClientUser, mode]);

  useEffect(() => {
    const query = supabase.from("clients").select("company_id, company_name");

    // Client users only see their own company
    const finalQuery = isClientUser && userRole?.company_id
      ? query.eq("company_id", userRole.company_id)
      : query;

    finalQuery.then(({ data }) => {
      if (data) {
        setClientOptions(
          data.map((d: Pick<Client, "company_id" | "company_name">) => ({
            id: d.company_id,
            name: d.company_name,
          }))
        );
      }
    });
  }, [isClientUser, userRole?.company_id]);

  // Flatten agentsByClient into a flat list of rows
  const flatAgents = useMemo<FlatAgent[]>(() => {
    const rows: FlatAgent[] = [];
    for (const group of agentsByClient) {
      for (const agent of group.agents) {
        rows.push({
          setterName: agent.setterName,
          companyId: agent.companyId ?? group.companyId,
          companyName: agent.companyName ?? group.companyName,
          appointmentsBooked: agent.appointmentsBooked,
          weeklyAvg: agent.weeklyAvg,
          achievement: agent.achievement,
        });
      }
    }
    return rows;
  }, [agentsByClient]);

  // Sorted flat agents
  const sortedAgents = useMemo(() => {
    const sorted = [...flatAgents];
    sorted.sort((a, b) => {
      let cmp = 0;
      const fieldA = a[sortField];
      const fieldB = b[sortField];
      if (typeof fieldA === "string" && typeof fieldB === "string") {
        cmp = fieldA.localeCompare(fieldB);
      } else {
        cmp = (fieldA as number) - (fieldB as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [flatAgents, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

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
          {/* Pill toggle — hidden for client users */}
          {!isClientUser && (
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
          )}

          <FilterBar
            filters={filters}
            onFiltersChange={onFiltersChange}
            clientOptions={isClientUser ? [] : clientOptions}
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
              <div className="grid gap-4 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20" style={{ gridTemplateColumns: "minmax(250px, 2fr) 90px 70px 70px 70px 3fr" }}>
                <div className="pl-8">Clients</div>
                <div>Status</div>
                <div className="text-center">Seats</div>
                <div className="text-center">Agents</div>
                <div className="text-center">Appts</div>
                <div>Achievement</div>
              </div>

              {clients.map((client) => (
                <ExpandableRow
                  key={client.companyId}
                  header={
                    <div className="grid gap-4 items-center py-2 pr-4" style={{ gridTemplateColumns: "minmax(250px, 2fr) 90px 70px 70px 70px 3fr" }}>
                      <div>
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-primary/15 text-foreground truncate max-w-[220px]">
                          <TruncatedName name={client.companyName} maxLen={24} />
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
                      <div>
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
          /* ── Agent Performance (flat sortable table) ── */
          sortedAgents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No active agents found in the selected date range.
            </div>
          ) : (
            <div className="glass-card mx-4 mb-4 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20">
                <button
                  type="button"
                  onClick={() => handleSort("setterName")}
                  className="col-span-3 flex items-center gap-0.5 text-left hover:text-foreground transition-colors cursor-pointer"
                >
                  Agent Name
                  <SortArrow field="setterName" sortField={sortField} sortDir={sortDir} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSort("companyName")}
                  className="col-span-2 flex items-center gap-0.5 text-left hover:text-foreground transition-colors cursor-pointer"
                >
                  Client
                  <SortArrow field="companyName" sortField={sortField} sortDir={sortDir} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSort("appointmentsBooked")}
                  className="col-span-1 flex items-center justify-center gap-0.5 hover:text-foreground transition-colors cursor-pointer"
                >
                  Appts
                  <SortArrow field="appointmentsBooked" sortField={sortField} sortDir={sortDir} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSort("weeklyAvg")}
                  className="col-span-1 flex items-center justify-center gap-0.5 hover:text-foreground transition-colors cursor-pointer"
                >
                  Wk Avg
                  <SortArrow field="weeklyAvg" sortField={sortField} sortDir={sortDir} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSort("achievement")}
                  className="col-span-1 flex items-center justify-center gap-0.5 hover:text-foreground transition-colors cursor-pointer"
                >
                  Achv %
                  <SortArrow field="achievement" sortField={sortField} sortDir={sortDir} />
                </button>
                <div className="col-span-4 flex items-center">
                  Progress
                </div>
              </div>

              {/* Table rows */}
              {sortedAgents.map((agent, idx) => (
                <div
                  key={`${agent.companyId}-${agent.setterName}-${idx}`}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-t border-border hover:bg-muted/20 transition-colors"
                >
                  <div className="col-span-3 text-sm font-medium text-foreground">
                    <TruncatedName name={agent.setterName} maxLen={24} />
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-foreground inline-block truncate max-w-[140px]">
                      <TruncatedName name={agent.companyName} maxLen={18} />
                    </span>
                  </div>
                  <div className="col-span-1 text-center text-sm font-semibold text-foreground tabular-nums">
                    {agent.appointmentsBooked}
                  </div>
                  <div className="col-span-1 text-center text-sm text-muted-foreground tabular-nums">
                    {agent.weeklyAvg.toFixed(1)}
                  </div>
                  <div className="col-span-1 text-center text-sm font-semibold text-foreground tabular-nums">
                    {agent.achievement.toFixed(0)}%
                  </div>
                  <div className="col-span-4">
                    <ProgressBar percentage={agent.achievement} height={6} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </motion.div>
    </TooltipProvider>
  );
}
