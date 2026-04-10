import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Save, Calendar } from "lucide-react";

interface AgentStartDateRow {
  id?: string;
  agent_name: string;
  company_name: string | null;
  start_date: string;
  status: string;
}

interface KnownAgent {
  agent_name: string;
  company_name: string;
  first_appointment: string;
  appointment_count: number;
}

interface MergedAgent {
  agent_name: string;
  company_name: string;
  first_appointment: string;
  appointment_count: number;
  fallbackDate: string;
  start_date: string;
  status: string;
  hasRecord: boolean;
  id?: string;
}

export function AgentStartDates() {
  const [startDates, setStartDates] = useState<AgentStartDateRow[]>([]);
  const [knownAgents, setKnownAgents] = useState<KnownAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch existing start dates
    let existingDates: AgentStartDateRow[] = [];
    try {
      const { data } = await supabase
        .from("agent_start_dates")
        .select("*")
        .order("agent_name");
      if (data) existingDates = data as AgentStartDateRow[];
    } catch {
      // Table may not exist yet
    }
    setStartDates(existingDates);

    // Fetch unique agent/company combos from appointments
    try {
      const { data: appts } = await supabase
        .from("appointments_new")
        .select("setter_name, \"Company Name\", created_at")
        .range(0, 49999);

      if (appts) {
        const agentMap = new Map<string, KnownAgent>();
        for (const a of appts) {
          const name = (a.setter_name as string | null)?.trim();
          const company = (a["Company Name"] as string | null)?.trim() || "Unknown";
          if (!name) continue;
          const key = `${name}_${company}`;
          const existing = agentMap.get(key);
          const createdAt = a.created_at as string;
          if (!existing) {
            agentMap.set(key, {
              agent_name: name,
              company_name: company,
              first_appointment: createdAt,
              appointment_count: 1,
            });
          } else {
            existing.appointment_count++;
            if (createdAt && createdAt < existing.first_appointment) {
              existing.first_appointment = createdAt;
            }
          }
        }
        setKnownAgents(
          Array.from(agentMap.values()).sort((a, b) =>
            a.company_name.localeCompare(b.company_name) || a.agent_name.localeCompare(b.agent_name)
          )
        );
      }
    } catch {
      // ignore
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Merge known agents with existing start dates
  const mergedAgents: MergedAgent[] = knownAgents.map((ka) => {
    const existing = startDates.find(
      (sd) => sd.agent_name.trim() === ka.agent_name && (sd.company_name || "").trim() === ka.company_name
    );
    return {
      ...ka,
      id: existing?.id,
      start_date: existing?.start_date || "",
      status: existing?.status || "active",
      hasRecord: !!existing,
      fallbackDate: ka.first_appointment ? ka.first_appointment.split("T")[0] : "",
    };
  });

  const handleSave = async (agent: MergedAgent, newDate: string, newStatus: string) => {
    const key = `${agent.agent_name}_${agent.company_name}`;
    setSaving(key);
    setStatusMsg(null);

    try {
      if (agent.id) {
        const { error } = await supabase
          .from("agent_start_dates")
          .update({ start_date: newDate, status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", agent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_start_dates")
          .insert({
            agent_name: agent.agent_name,
            company_name: agent.company_name,
            start_date: newDate,
            status: newStatus,
          });
        if (error) throw error;
      }
      setStatusMsg(`Saved ${agent.agent_name}`);
      fetchData();
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : "Failed to save"}`);
    }
    setSaving(null);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group by company
  const byCompany = new Map<string, MergedAgent[]>();
  for (const a of mergedAgents) {
    const list = byCompany.get(a.company_name) ?? [];
    list.push(a);
    byCompany.set(a.company_name, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Agent Start Dates
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Set each agent's campaign start date for accurate achievement calculation. Agents without a start date use their first appointment date as fallback.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className={`mb-4 px-3 py-2 rounded-md text-sm ${
          statusMsg.startsWith("Error")
            ? "bg-destructive/10 border border-destructive/30 text-destructive"
            : "bg-blue-500/10 border border-blue-500/30 text-blue-400"
        }`}>
          {statusMsg}
        </div>
      )}

      {mergedAgents.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No agents found in appointment data.</p>
        </div>
      ) : (
        Array.from(byCompany.entries()).map(([company, agents]) => (
          <div key={company} className="glass-card overflow-x-auto mb-4">
            <div className="px-4 py-2.5 border-b border-border bg-muted/10">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{company}</span>
              <span className="text-xs text-muted-foreground ml-2">({agents.length} agent{agents.length !== 1 ? "s" : ""})</span>
            </div>
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20">
              <div className="col-span-3">Agent Name</div>
              <div className="col-span-2 text-center">Appointments</div>
              <div className="col-span-2 text-center">First Appt</div>
              <div className="col-span-2 text-center">Start Date</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-1"></div>
            </div>
            {agents.map((agent) => (
              <AgentRow
                key={`${agent.agent_name}_${agent.company_name}`}
                agent={agent}
                saving={saving === `${agent.agent_name}_${agent.company_name}`}
                onSave={handleSave}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function AgentRow({
  agent,
  saving,
  onSave,
}: {
  agent: MergedAgent;
  saving: boolean;
  onSave: (agent: MergedAgent, date: string, status: string) => void;
}) {
  const [date, setDate] = useState(agent.start_date || agent.fallbackDate);
  const [status, setStatus] = useState(agent.status);
  const isDirty = date !== agent.start_date || status !== agent.status || !agent.hasRecord;

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center border-t border-border hover:bg-muted/10 transition-colors">
      <div className="col-span-3 text-sm font-medium text-foreground truncate" title={agent.agent_name}>
        {agent.agent_name}
        {!agent.hasRecord && (
          <span className="ml-1.5 text-[10px] text-muted-foreground/60 italic">no record</span>
        )}
      </div>
      <div className="col-span-2 text-center text-sm text-muted-foreground tabular-nums">{agent.appointment_count}</div>
      <div className="col-span-2 text-center text-xs text-muted-foreground/60 tabular-nums">{agent.fallbackDate || "—"}</div>
      <div className="col-span-2 flex justify-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border bg-card text-foreground px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 w-full max-w-[140px]"
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border bg-card text-foreground px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="active">Active</option>
          <option value="training">Training</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>
      <div className="col-span-1 flex justify-center">
        {isDirty && date && (
          <button
            onClick={() => onSave(agent, date, status)}
            disabled={saving}
            className="p-1.5 rounded hover:bg-primary/20 text-primary transition-colors disabled:opacity-40"
            title="Save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
