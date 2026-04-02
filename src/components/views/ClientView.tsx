import { useState, useEffect } from "react";
import { useClients } from "../../hooks/useClients";
import { FilterBar } from "../layout/FilterBar";
import { ExpandableRow } from "../shared/ExpandableRow";
import { ProgressBar } from "../shared/ProgressBar";
import { supabase } from "../../lib/supabase";
import type { FilterState, Client } from "../../types";
import { Loader2 } from "lucide-react";

interface ClientViewProps {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

export function ClientView({ filters, onFiltersChange }: ClientViewProps) {
  const { clients, loading, error } = useClients(filters);
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
        searchPlaceholder="Search clients..."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-accent-cyan" />
        </div>
      ) : clients.length === 0 ? (
        <div className="p-8 text-center text-text-secondary">
          No client data found. Ensure the <code>clients</code> table is populated.
        </div>
      ) : (
        <div className="card mx-4 mb-4 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-8 gap-2 px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle bg-bg-elevated/50">
            <div className="col-span-1 pl-8">Client</div>
            <div>Status</div>
            <div className="text-center">Seats</div>
            <div className="text-center">Active Agents</div>
            <div className="text-center">Appointments</div>
            <div className="col-span-2">Achievement</div>
            <div className="text-center">Leads</div>
          </div>

          {/* Client Rows */}
          {clients.map((client) => (
            <ExpandableRow
              key={client.companyId}
              header={
                <div className="grid grid-cols-8 gap-2 items-center py-2 pr-4">
                  <div className="col-span-1">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-accent-purple/20 text-accent-cyan">
                      {client.companyName}
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
                  <div className="text-center text-sm font-semibold tabular-nums">
                    {client.totalLeads}
                  </div>
                </div>
              }
            >
              {/* Agent Sub-Table */}
              {client.agents.length === 0 ? (
                <div className="text-sm text-text-secondary py-2">
                  No active agents in this campaign.
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden border border-border-subtle">
                  <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-semibold text-text-secondary uppercase bg-bg-elevated/30">
                    <div>Agent</div>
                    <div className="text-center">Appointments</div>
                    <div className="text-center">Weekly Avg</div>
                    <div className="col-span-2">Achievement</div>
                    <div className="text-center">Leads</div>
                  </div>
                  {client.agents.map((agent) => (
                    <div
                      key={agent.setterName}
                      className="grid grid-cols-6 gap-2 px-4 py-2.5 items-center border-t border-border-subtle hover:bg-white/[0.02] transition-colors"
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
                      <div className="text-center text-sm tabular-nums">
                        {agent.totalLeads}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ExpandableRow>
          ))}
        </div>
      )}
    </div>
  );
}
