import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { isValidAppointment, clientAchievement, getAchievementColor } from "@/lib/calculations";
import { countBusinessDays, getEffectiveDateRange, getEarliestDate } from "@/lib/dateUtils";
import { groupAppointmentsByClient } from "@/lib/clientMatch";
import { StatCard } from "@/components/shared/StatCard";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { TruncatedName } from "@/components/shared/TruncatedName";
import type { Appointment, Client, DateRange } from "@/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  CalendarCheck,
  TrendingUp,
  CalendarClock,
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

interface OverviewProps {
  dateRange: DateRange;
}

// Chart colors
const ROOF_COLORS: Record<string, string> = {
  Shingles: "#0ea5e9",
  Shingle: "#0ea5e9",
  Tiles: "#f59e0b",
  Tile: "#f59e0b",
  Flat: "#ef4444",
};
const OTHER_COLOR = "#6b7280";
const YES_COLOR = "#f59e0b";
const NO_COLOR = "#22c55e";
const CREDIT_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#0ea5e9"];
const BAR_COLOR = "#0ea5e9";
const APPT_TYPE_COLORS = ["#0ea5e9", "#a855f7", "#6b7280"];

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

const RADIAN = Math.PI / 180;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name } = props;
  if (!percent || percent < 0.04) return null;
  const radius = (outerRadius ?? 70) + 18;
  const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
  return (
    <text x={x} y={y} fill="#94a3b8" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11}>
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

export function Overview({ dateRange }: OverviewProps) {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalActiveAgents: 0,
    totalAppointments: 0,
    avgAchievement: 0,
    avgBookOut: 0,
    clientSummaries: [] as {
      name: string;
      achievement: number;
      appointments: number;
      seats: number;
    }[],
  });
  const [rangeAppts, setRangeAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const [clientsRes, appointmentsRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("appointments_new").select("*"),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      const allClients: Client[] = clientsRes.data ?? [];
      const allAppointments: Appointment[] = appointmentsRes.data ?? [];

      const earliest = getEarliestDate(allAppointments);
      const { start: rangeStart, end: rangeEnd } = getEffectiveDateRange(
        dateRange.start, dateRange.end, earliest
      );
      const bizDays = countBusinessDays(rangeStart, rangeEnd);

      const { groups } = groupAppointmentsByClient(allAppointments, allClients);

      const allRangeAppts = allAppointments.filter((a) => {
        if (!a.created_at) return false;
        const d = new Date(a.created_at);
        return d >= rangeStart && d <= rangeEnd;
      });
      const allValidAppts = allRangeAppts.filter(isValidAppointment);
      const allActiveAgents = new Set<string>();
      allRangeAppts.forEach((a) => {
        if (a.setter_name) allActiveAgents.add(a.setter_name);
      });

      setRangeAppts(allRangeAppts);

      const achievements: number[] = [];
      const clientSummaries = allClients.map((client) => {
        const companyAppts = groups.get(client.company_id) ?? [];
        const rangeAppts = companyAppts.filter((a) => {
          if (!a.created_at) return false;
          const d = new Date(a.created_at);
          return d >= rangeStart && d <= rangeEnd;
        });
        const validCount = rangeAppts.filter(isValidAppointment).length;
        const achievement = clientAchievement(validCount, client.seats_purchased, bizDays);
        achievements.push(achievement);
        return { name: client.company_name, achievement, appointments: validCount, seats: client.seats_purchased };
      });

      const avgAchievement = achievements.length > 0
        ? achievements.reduce((a, b) => a + b, 0) / achievements.length : 0;

      const bookOutDays: number[] = [];
      for (const appt of allRangeAppts) {
        if (!appt.booked_for || !appt.created_at) continue;
        try {
          const createdDate = new Date(appt.created_at);
          const bookedDate = new Date(appt.booked_for);
          if (isNaN(bookedDate.getTime()) || isNaN(createdDate.getTime())) continue;
          const diffMs = bookedDate.getTime() - createdDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays >= 0) bookOutDays.push(diffDays);
        } catch { /* skip */ }
      }
      const avgBookOut = bookOutDays.length > 0
        ? bookOutDays.reduce((a, b) => a + b, 0) / bookOutDays.length : 0;

      setStats({
        totalClients: allClients.length,
        totalActiveAgents: allActiveAgents.size,
        totalAppointments: allValidAppts.length,
        avgAchievement,
        avgBookOut,
        clientSummaries: clientSummaries.sort((a, b) => b.achievement - a.achievement),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Overview] fetch error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const channel = supabase
      .channel("overview-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments_new" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => fetchStats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  // Chart data computations
  const roofTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    rangeAppts.forEach((a) => {
      const rt = a.roof_type?.trim() || "Unknown";
      counts[rt] = (counts[rt] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rangeAppts]);

  const existingSolarData = useMemo(() => {
    let yes = 0, no = 0;
    rangeAppts.forEach((a) => {
      const v = a.existing_solar?.toLowerCase().trim();
      if (v === "yes" || v === "true") yes++;
      else no++;
    });
    return [
      { name: "Yes", value: yes },
      { name: "No", value: no },
    ].filter((d) => d.value > 0);
  }, [rangeAppts]);

  const shadingData = useMemo(() => {
    let yes = 0, no = 0;
    rangeAppts.forEach((a) => {
      const v = a.shading?.toLowerCase().trim();
      if (v === "yes" || v === "true") yes++;
      else no++;
    });
    return [
      { name: "Yes", value: yes },
      { name: "No", value: no },
    ].filter((d) => d.value > 0);
  }, [rangeAppts]);

  const creditScoreData = useMemo(() => {
    const ranges = [
      { name: "< 600", min: 0, max: 599, count: 0 },
      { name: "600-649", min: 600, max: 649, count: 0 },
      { name: "650-699", min: 650, max: 699, count: 0 },
      { name: "700-749", min: 700, max: 749, count: 0 },
      { name: "750+", min: 750, max: 999, count: 0 },
    ];
    rangeAppts.forEach((a) => {
      if (!a.credit_score) return;
      const score = parseInt(a.credit_score, 10);
      if (isNaN(score)) return;
      for (const r of ranges) {
        if (score >= r.min && score <= r.max) { r.count++; break; }
      }
    });
    return ranges.map((r) => ({ name: r.name, count: r.count }));
  }, [rangeAppts]);

  const dqReasonData = useMemo(() => {
    const counts: Record<string, number> = {};
    rangeAppts.forEach((a) => {
      if (!a.dq_reason) return;
      const reason = a.dq_reason.trim();
      if (!reason) return;
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rangeAppts]);

  const apptTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    rangeAppts.forEach((a) => {
      const t = a.appointment_type?.trim() || "Unknown";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rangeAppts]);

  const totalSolar = existingSolarData.reduce((s, d) => s + d.value, 0);
  const totalShading = shadingData.reduce((s, d) => s + d.value, 0);

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
        className="p-6"
      >
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <strong>Data loading error:</strong> {error}
          </div>
        )}

        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary mb-1">
            Performance Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Real-time overview of all campaigns and agent performance.
          </p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Active Clients"
            value={stats.totalClients}
            icon={<Building2 size={16} className="text-primary" />}
          />
          <StatCard
            label="Active Agents"
            value={stats.totalActiveAgents}
            icon={<Users size={16} className="text-primary" />}
          />
          <StatCard
            label="Total Appointments"
            value={stats.totalAppointments}
            icon={<CalendarCheck size={16} className="text-primary" />}
          />
          <StatCard
            label="Avg Achievement"
            value={`${stats.avgAchievement.toFixed(1)}%`}
            icon={<TrendingUp size={16} className="text-primary" />}
            accentColor={getAchievementColor(stats.avgAchievement)}
          />
          <StatCard
            label="Avg Book-Out"
            value={`${stats.avgBookOut.toFixed(1)} days`}
            icon={<CalendarClock size={16} className="text-primary" />}
          />
        </div>

        {/* Client Campaign Health */}
        <div className="glass-card p-5 mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Campaign Health
          </h2>
          <AnimatePresence>
            {stats.clientSummaries.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No campaign data. Add entries to the <code>clients</code> table to get started.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {stats.clientSummaries.map((c, i) => (
                  <motion.div
                    key={`${c.name}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: i * 0.03 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-[180px] shrink-0">
                      <TruncatedName
                        name={c.name}
                        maxLen={20}
                        className="text-sm font-medium text-foreground"
                      />
                    </div>
                    <div className="flex-1">
                      <ProgressBar percentage={c.achievement} />
                    </div>
                    <div className="min-w-[80px] text-right">
                      <span className="text-xs text-muted-foreground">
                        {c.appointments} appts / {c.seats} seats
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Appointment Insights */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Appointment Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Roof Type Distribution */}
            <ChartCard title="Roof Type Distribution">
              {roofTypeData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={roofTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={renderPieLabel}
                      strokeWidth={0}
                    >
                      {roofTypeData.map((entry, i) => (
                        <Cell key={i} fill={ROOF_COLORS[entry.name] ?? OTHER_COLOR} />
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

            {/* Existing Solar */}
            <ChartCard title="Existing Solar">
              {existingSolarData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={existingSolarData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {existingSolarData.map((entry, i) => (
                        <Cell key={i} fill={entry.name === "Yes" ? YES_COLOR : NO_COLOR} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#f1f5f9" }}
                    />
                    <text x="50%" y="44%" textAnchor="middle" fill="#f9fafb" fontSize={18} fontWeight="bold">
                      {totalSolar}
                    </text>
                    <text x="50%" y="56%" textAnchor="middle" fill="#64748b" fontSize={10}>
                      total
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: NO_COLOR }} /> No (new opp.)
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: YES_COLOR }} /> Yes
                </span>
              </div>
            </ChartCard>

            {/* Shading */}
            <ChartCard title="Shading">
              {shadingData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={shadingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {shadingData.map((entry, i) => (
                        <Cell key={i} fill={entry.name === "Yes" ? YES_COLOR : NO_COLOR} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#f1f5f9" }}
                    />
                    <text x="50%" y="44%" textAnchor="middle" fill="#f9fafb" fontSize={18} fontWeight="bold">
                      {totalShading}
                    </text>
                    <text x="50%" y="56%" textAnchor="middle" fill="#64748b" fontSize={10}>
                      total
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: NO_COLOR }} /> No
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: YES_COLOR }} /> Yes
                </span>
              </div>
            </ChartCard>

            {/* Credit Score Distribution */}
            <ChartCard title="Credit Score Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={creditScoreData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "#f1f5f9" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {creditScoreData.map((_, i) => (
                      <Cell key={i} fill={CREDIT_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* DQ Reasons */}
            <ChartCard title="DQ Reasons">
              {dqReasonData.length === 0 ? (
                <div className="flex items-center justify-center h-[220px]">
                  <p className="text-muted-foreground text-sm">No DQ'd appointments</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dqReasonData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <RechartsTooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#f1f5f9" }}
                    />
                    <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Appointment Type Breakdown */}
            <ChartCard title="Appointment Type">
              {apptTypeData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No data</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={apptTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {apptTypeData.map((_, i) => (
                          <Cell key={i} fill={APPT_TYPE_COLORS[i % APPT_TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                        itemStyle={{ color: "#f1f5f9" }}
                      />
                      <text x="50%" y="44%" textAnchor="middle" fill="#f9fafb" fontSize={18} fontWeight="bold">
                        {apptTypeData.reduce((s, d) => s + d.value, 0)}
                      </text>
                      <text x="50%" y="56%" textAnchor="middle" fill="#64748b" fontSize={10}>
                        total
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-1">
                    {apptTypeData.map((d, i) => (
                      <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: APPT_TYPE_COLORS[i % APPT_TYPE_COLORS.length] }} />
                        {d.name} ({d.value})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
