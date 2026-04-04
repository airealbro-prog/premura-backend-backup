import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { FrontendMetric, DateRange } from "@/types";
import { motion } from "framer-motion";
import { Loader2, Phone, User, Megaphone, Calendar } from "lucide-react";

interface FrontendPipelineProps {
  dateRange: DateRange;
}

const PIPELINE_STAGES = [
  "New Lead",
  "Appointment Booked",
  "Follow-Up",
  "Rescheduled",
  "No Answer",
  "Disqualified",
  "Sale",
  "Client Closed",
  "Not Interested",
] as const;

const STAGE_COLORS: Record<string, string> = {
  "New Lead": "#3b82f6",
  "Appointment Booked": "#8851F4",
  "Follow-Up": "#f59e0b",
  "Rescheduled": "#06b6d4",
  "No Answer": "#94a3b8",
  "Disqualified": "#ef4444",
  "Sale": "#22c55e",
  "Client Closed": "#22c55e",
  "Not Interested": "#ef4444",
};

function normalizeStage(raw: string | null): string {
  if (!raw) return "New Lead";
  const s = raw.trim().toLowerCase();
  for (const stage of PIPELINE_STAGES) {
    if (s === stage.toLowerCase()) return stage;
  }
  // Fuzzy matching
  if (s.includes("follow")) return "Follow-Up";
  if (s.includes("rescheduled") || s.includes("reschedule")) return "Rescheduled";
  if (s.includes("no answer") || s.includes("no show")) return "No Answer";
  if (s.includes("disqualif") || s.includes("dq")) return "Disqualified";
  if (s.includes("sale") || s.includes("closed") || s.includes("won")) return "Sale";
  if (s.includes("client closed")) return "Client Closed";
  if (s.includes("not interested") || s.includes("dead")) return "Not Interested";
  if (s.includes("booked") || s.includes("appointment")) return "Appointment Booked";
  return "New Lead";
}

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return raw; }
}

function cleanCampaignName(raw: string | null): string {
  if (!raw) return "";
  let s = raw.trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) s = String(arr[0]);
    } catch { /* use as-is */ }
  }
  s = s.replace(/^["']+|["']+$/g, "").trim();
  const dashIdx = s.lastIndexOf(" - ");
  if (dashIdx > 0) s = s.substring(dashIdx + 3).trim();
  return s;
}

export function FrontendPipeline({ dateRange }: FrontendPipelineProps) {
  const [metrics, setMetrics] = useState<FrontendMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string>("New Lead");

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("frontend_metrics").select("*");
      if (error) throw error;
      setMetrics((data as FrontendMetric[]) ?? []);
    } catch (err) {
      console.error("[FrontendPipeline] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter by date
  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      const raw = m["Date"];
      if (!raw) return true;
      try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return true;
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
      } catch { return true; }
      return true;
    });
  }, [metrics, dateRange]);

  // Group by stage
  const stageGroups = useMemo(() => {
    const groups: Record<string, FrontendMetric[]> = {};
    for (const stage of PIPELINE_STAGES) {
      groups[stage] = [];
    }
    filtered.forEach((m) => {
      const stage = normalizeStage(m["Status / Stage in Pipeline"] || m["Disposition/Outcome"]);
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(m);
    });
    return groups;
  }, [filtered]);

  const activeLeads = stageGroups[activeStage] ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="p-3 sm:p-6"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-1">Pipeline</h1>
        <p className="text-muted-foreground text-sm">
          Lead pipeline grouped by stage. Click a stage to view leads.
        </p>
      </div>

      {/* Stage tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PIPELINE_STAGES.map((stage) => {
          const count = stageGroups[stage]?.length ?? 0;
          const isActive = activeStage === stage;
          const color = STAGE_COLORS[stage] || "#94a3b8";
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                isActive
                  ? "text-white border-transparent"
                  : "text-muted-foreground border-border bg-card hover:text-foreground hover:bg-muted/20"
              }`}
              style={isActive ? { background: color, borderColor: color } : undefined}
            >
              {stage}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                  isActive ? "bg-white/20 text-white" : "bg-muted/30 text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Leads table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border" style={{ background: "#111827" }}>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Lead Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Closer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Setter</th>
              </tr>
            </thead>
            <tbody>
              {activeLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No leads in this stage.
                  </td>
                </tr>
              ) : (
                activeLeads.map((lead, idx) => {
                  const contactUrl = lead["GHL Contact Link"];
                  return (
                    <tr key={lead.id ?? idx} className="border-b border-border hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2.5">
                        {contactUrl ? (
                          <a
                            href={contactUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            {lead["Lead Name"] || "—"}
                          </a>
                        ) : (
                          <span className="font-medium text-foreground">{lead["Lead Name"] || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {lead["Phone Number"] ? (
                          <span className="flex items-center gap-1.5">
                            <Phone size={12} className="text-muted-foreground" />
                            {lead["Phone Number"]}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Megaphone size={12} />
                          {cleanCampaignName(lead["Campaign Name"] || lead["Source Campaign"]) || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar size={12} />
                          {formatDate(lead["Date"])}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <User size={12} />
                          {lead["Closer"] || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {lead["Setter"] || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
