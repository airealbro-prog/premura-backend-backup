import { useState, useEffect, useCallback } from "react";
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
  Loader2,
} from "lucide-react";

interface OverviewProps {
  dateRange: DateRange;
}

export function Overview({ dateRange }: OverviewProps) {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalActiveAgents: 0,
    totalAppointments: 0,
    avgAchievement: 0,
    clientSummaries: [] as {
      name: string;
      achievement: number;
      appointments: number;
      seats: number;
    }[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const [clientsRes, appointmentsRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("appointments_new").select("*"),
      ]);

      if (clientsRes.error) {
        console.error("[Overview] clients query error:", clientsRes.error);
        throw clientsRes.error;
      }
      if (appointmentsRes.error) {
        console.error("[Overview] appointments_new query error:", appointmentsRes.error);
        throw appointmentsRes.error;
      }

      const allClients: Client[] = clientsRes.data ?? [];
      const allAppointments: Appointment[] = appointmentsRes.data ?? [];

      console.log(`[Overview] Loaded ${allClients.length} clients, ${allAppointments.length} appointments`);

      // Build effective date range (handle null start/end)
      const earliest = getEarliestDate(allAppointments);
      const { start: rangeStart, end: rangeEnd } = getEffectiveDateRange(
        dateRange.start, dateRange.end, earliest
      );
      const bizDays = countBusinessDays(rangeStart, rangeEnd);

      // Group appointments by client using company_id + Company Name fallback
      const { groups, unmatched } = groupAppointmentsByClient(allAppointments, allClients);

      if (unmatched.length > 0) {
        console.warn(`[Overview] ${unmatched.length} appointments not matched to any client:`);
        const unmatchedIds = [...new Set(unmatched.map(a => a.company_id))];
        console.warn("[Overview] Unmatched company_ids:", unmatchedIds);
        const unmatchedNames = [...new Set(unmatched.map(a => a["Company Name"]).filter(Boolean))];
        console.warn("[Overview] Unmatched Company Names:", unmatchedNames);
      }

      // Debug: log matching stats per client
      for (const client of allClients) {
        const matched = groups.get(client.company_id) ?? [];
        console.log(`[Overview] Client "${client.company_name}" (${client.company_id}): ${matched.length} appointments`);
      }

      // Count ALL appointments and agents globally (not just matched)
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

      console.log(`[Overview] Date range: ${rangeStart.toISOString()} - ${rangeEnd.toISOString()}`);
      console.log(`[Overview] Appointments in range: ${allRangeAppts.length}, valid: ${allValidAppts.length}, agents: ${allActiveAgents.size}`);

      // Per-client summaries
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

        return {
          name: client.company_name,
          achievement,
          appointments: validCount,
          seats: client.seats_purchased,
        };
      });

      const avgAchievement = achievements.length > 0
        ? achievements.reduce((a, b) => a + b, 0) / achievements.length
        : 0;

      setStats({
        totalClients: allClients.length,
        totalActiveAgents: allActiveAgents.size,
        totalAppointments: allValidAppts.length,
        avgAchievement,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
        </div>

        {/* Client Campaign Health */}
        <div className="glass-card p-5">
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
      </motion.div>
    </TooltipProvider>
  );
}
