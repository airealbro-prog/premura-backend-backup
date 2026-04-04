import { useState, useEffect, useCallback, useMemo } from "react";
import { supabaseFrontend } from "@/lib/supabaseFrontend";
import { StatCard } from "@/components/shared/StatCard";
import type { FrontendMetric, DateRange } from "@/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import {
  Users,
  CalendarCheck,
  Eye,
  DollarSign,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface FrontendOverviewProps {
  dateRange: DateRange;
}

const PALETTE = ["#8851F4", "#3b82f6", "#f59e0b", "#ef4444", "#22c55e", "#06b6d4", "#94a3b8"];

function parseDealValue(raw: string | null): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function cleanCampaignName(raw: string | null): string {
  if (!raw) return "Unknown";
  let s = raw.trim();
  // Strip JSON-like brackets/quotes
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) s = String(arr[0]);
    } catch { /* use as-is */ }
  }
  s = s.replace(/^["']+|["']+$/g, "").trim();
  // Extract just the meaningful part (after " - " if present)
  const dashIdx = s.lastIndexOf(" - ");
  if (dashIdx > 0) s = s.substring(dashIdx + 3).trim();
  return s || "Unknown";
}

function isYes(val: string | null): boolean {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  return v === "yes" || v === "true" || v === "1";
}

const RADIAN = Math.PI / 180;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name } = props;
  if (!percent || percent < 0.04) return null;
  const radius = (outerRadius ?? 70) + 20;
  const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
  return (
    <text x={x} y={y} fill="#94a3b8" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11}>
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5 flex flex-col">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export function FrontendOverview({ dateRange }: FrontendOverviewProps) {
  const [metrics, setMetrics] = useState<FrontendMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const { data, error: err } = await supabaseFrontend.from("Frontend Metrics").select("*");
      if (err) throw err;
      setMetrics((data as FrontendMetric[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter by date range
  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      const raw = m["Created At"];
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

  // Stats
  const stats = useMemo(() => {
    const totalLeads = filtered.length;
    const booked = filtered.filter((m) => isYes(m["Appointment Booked"]));
    const appointmentsBooked = booked.length;
    const shows = booked.filter((m) => isYes(m["Appointment Show"]));
    const showRate = appointmentsBooked > 0 ? (shows.length / appointmentsBooked) * 100 : 0;
    const sales = filtered.filter((m) => {
      const s = m["Status / Stage in Pipeline"]?.toLowerCase().trim();
      return s === "sale" || s === "client closed";
    });
    const totalRevenue = filtered.reduce((sum, m) => sum + parseDealValue(m["Deal Value"]), 0);
    return { totalLeads, appointmentsBooked, showRate, sales: sales.length, totalRevenue };
  }, [filtered]);

  // Funnel data
  const funnelData = useMemo(() => {
    const newLeads = filtered.length;
    const booked = filtered.filter((m) => isYes(m["Appointment Booked"])).length;
    const showed = filtered.filter((m) => isYes(m["Appointment Show"])).length;
    const pitched = filtered.filter((m) => isYes(m["Pitch"])).length;
    const sales = filtered.filter((m) => {
      const s = m["Status / Stage in Pipeline"]?.toLowerCase().trim();
      return s === "sale" || s === "client closed";
    }).length;
    return [
      { name: "New Leads", value: newLeads },
      { name: "Appts Booked", value: booked },
      { name: "Showed", value: showed },
      { name: "Pitched", value: pitched },
      { name: "Sales", value: sales },
    ];
  }, [filtered]);

  // Disposition breakdown
  const dispositionData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((m) => {
      const d = m["Disposition/Outcome"]?.trim() || m["Status / Stage in Pipeline"]?.trim() || "Unknown";
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Campaign performance
  const campaignData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((m) => {
      const name = cleanCampaignName(m["Campaign Name"] || m["Source Campaign"]);
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="p-3 sm:p-6"
      >
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <strong>Data loading error:</strong> {error}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary mb-1">Sales Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Frontend sales pipeline overview and performance metrics.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Total Leads"
            value={stats.totalLeads}
            icon={<Users size={16} className="text-primary" />}
          />
          <StatCard
            label="Appts Booked"
            value={stats.appointmentsBooked}
            icon={<CalendarCheck size={16} className="text-primary" />}
          />
          <StatCard
            label="Show Rate"
            value={`${stats.showRate.toFixed(1)}%`}
            icon={<Eye size={16} className="text-primary" />}
            accentColor={stats.showRate >= 60 ? "#3b82f6" : stats.showRate >= 40 ? "#f59e0b" : "#ef4444"}
          />
          <StatCard
            label="Sales"
            value={stats.sales}
            icon={<TrendingUp size={16} className="text-primary" />}
          />
          <StatCard
            label="Revenue"
            value={`$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={<DollarSign size={16} className="text-primary" />}
          />
        </div>

        {/* Pipeline Funnel */}
        <div className="glass-card p-5 mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Sales Funnel
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch gap-1">
            {funnelData.map((stage, i) => {
              const maxVal = funnelData[0]?.value || 1;
              const pct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
              const color = PALETTE[i % PALETTE.length];
              return (
                <div key={stage.name} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full rounded-md flex items-center justify-center py-4 sm:py-6 relative overflow-hidden"
                    style={{ background: `${color}20` }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-md"
                      style={{ width: `${pct}%`, background: `${color}30` }}
                    />
                    <span className="relative text-xl sm:text-2xl font-bold tabular-nums" style={{ color }}>
                      {stage.value}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 text-center font-medium">
                    {stage.name}
                  </span>
                  {i < funnelData.length - 1 && (
                    <div className="hidden sm:block text-muted-foreground/30 text-lg mt-1">→</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Disposition Breakdown */}
          <ChartCard title="Disposition Breakdown">
            {dispositionData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dispositionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={renderPieLabel}
                    strokeWidth={0}
                  >
                    {dispositionData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "#f1f5f9" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Campaign Performance */}
          <ChartCard title="Leads by Campaign">
            {campaignData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={campaignData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                  <RechartsTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "#f1f5f9" }}
                  />
                  <Bar dataKey="count" fill="#8851F4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
