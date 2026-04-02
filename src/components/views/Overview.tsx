import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { isValidAppointment, clientAchievement, getAchievementColor } from "../../lib/calculations";
import { countBusinessDays } from "../../lib/dateUtils";
import { StatCard } from "../shared/StatCard";
import { ProgressBar } from "../shared/ProgressBar";
import type { Appointment, Client, DateRange } from "../../types";
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

      console.log(`[Overview] Loaded ${clientsRes.data?.length ?? 0} clients, ${appointmentsRes.data?.length ?? 0} appointments`);

      const allClients: Client[] = clientsRes.data ?? [];
      const appointments: Appointment[] = appointmentsRes.data ?? [];
      const bizDays = countBusinessDays(dateRange.start, dateRange.end);

      const allActiveAgents = new Set<string>();
      let totalValidAppts = 0;
      const achievements: number[] = [];

      const clientSummaries = allClients.map((client) => {
        const companyAppts = appointments.filter((a) => a.company_id === client.company_id);

        const rangeAppts = companyAppts.filter((a) => {
          if (!a.disposition_date) return false;
          const d = new Date(a.disposition_date);
          return d >= dateRange.start && d <= dateRange.end;
        });

        // Active agents in range
        rangeAppts.forEach((a) => {
          if (a.setter_name && a.disposition_date) {
            allActiveAgents.add(a.setter_name);
          }
        });

        const validCount = rangeAppts.filter(isValidAppointment).length;
        totalValidAppts += validCount;

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
        totalAppointments: totalValidAppts,
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
        <Loader2 size={24} className="animate-spin text-accent-cyan" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <strong>Data loading error:</strong> {error}
        </div>
      )}
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold gradient-text mb-1">
          Performance Dashboard
        </h1>
        <p className="text-text-secondary text-sm">
          Real-time overview of all campaigns and agent performance.
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Clients"
          value={stats.totalClients}
          icon={<Building2 size={16} className="text-accent-cyan" />}
        />
        <StatCard
          label="Active Agents"
          value={stats.totalActiveAgents}
          icon={<Users size={16} className="text-accent-cyan" />}
        />
        <StatCard
          label="Total Appointments"
          value={stats.totalAppointments}
          icon={<CalendarCheck size={16} className="text-accent-cyan" />}
        />
        <StatCard
          label="Avg Achievement"
          value={`${stats.avgAchievement.toFixed(1)}%`}
          icon={<TrendingUp size={16} className="text-accent-cyan" />}
          accentColor={getAchievementColor(stats.avgAchievement)}
        />
      </div>

      {/* Client Campaign Health */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
          Campaign Health
        </h2>
        {stats.clientSummaries.length === 0 ? (
          <p className="text-text-secondary text-sm">
            No campaign data. Add entries to the <code>clients</code> table to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {stats.clientSummaries.map((c) => (
              <div key={c.name} className="flex items-center gap-4">
                <div className="min-w-[160px]">
                  <span className="text-sm font-medium text-text-primary">{c.name}</span>
                </div>
                <div className="flex-1">
                  <ProgressBar percentage={c.achievement} />
                </div>
                <div className="min-w-[80px] text-right">
                  <span className="text-xs text-text-secondary">
                    {c.appointments} appts / {c.seats} seats
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
