import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  isValidAppointment,
  clientAchievement,
  agentAchievement,
  weeklyAverage,
} from "@/lib/calculations";
import { countBusinessDays, getElapsedWeeks, getEffectiveDateRange, getEarliestDate } from "@/lib/dateUtils";
import { groupAppointmentsByClient } from "@/lib/clientMatch";
import { getClientAppointmentFilter } from "@/lib/clientFilter";
import type {
  Appointment,
  Client,
  LeaderboardEntry,
  FilterState,
  TimeFilter,
  DateRange,
} from "@/types";
import { startOfWeek, startOfMonth } from "date-fns";

function getTimeFilterRange(filter: TimeFilter, globalRange: DateRange): DateRange {
  const now = new Date();
  switch (filter) {
    case "week": {
      const monday = startOfWeek(now, { weekStartsOn: 1 });
      return { start: monday, end: now };
    }
    case "month": {
      return { start: startOfMonth(now), end: now };
    }
    case "custom":
      return globalRange;
  }
}

export function useLeaderboard(filters: FilterState) {
  const [topClients, setTopClients] = useState<LeaderboardEntry[]>([]);
  const [topAgents, setTopAgents] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userRole } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Exclude internal test accounts from all reporting.
      let clientsQuery = supabase.from("clients").select("*").eq("is_test", false).range(0, 49999);
      let appointmentsQuery = supabase.from("appointments_new").select("*").range(0, 49999);

      if ((userRole?.role === "client" || userRole?.role === ("client_admin" as string)) && userRole.company_id) {
        clientsQuery = clientsQuery.eq("company_id", userRole.company_id);
        const orFilter = await getClientAppointmentFilter(userRole.company_id);
        if (orFilter) {
          appointmentsQuery = appointmentsQuery.or(orFilter);
        } else {
          appointmentsQuery = appointmentsQuery.eq("company_id", userRole.company_id);
        }
      }

      const [clientsRes, appointmentsRes] = await Promise.all([
        clientsQuery,
        appointmentsQuery,
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      const allClients: Client[] = clientsRes.data ?? [];
      const allAppointments: Appointment[] = appointmentsRes.data ?? [];

      const range = getTimeFilterRange(filters.timeFilter, filters.dateRange);
      const earliest = getEarliestDate(allAppointments);
      const { start: rangeStart, end: rangeEnd } = getEffectiveDateRange(
        range.start, range.end, earliest
      );
      const bizDays = countBusinessDays(rangeStart, rangeEnd);
      const weeks = getElapsedWeeks(rangeStart, rangeEnd);

      const { groups } = groupAppointmentsByClient(allAppointments, allClients);

      // Client leaderboard
      const clientEntries: LeaderboardEntry[] = allClients
        .filter((c) => {
          if (filters.selectedClients.length > 0) return filters.selectedClients.includes(c.company_id);
          return true;
        })
        .map((client) => {
          const companyAppts = groups.get(client.company_id) ?? [];
          const valid = companyAppts.filter(
            (a) =>
              isValidAppointment(a) &&
              a.created_at &&
              new Date(a.created_at) >= rangeStart &&
              new Date(a.created_at) <= rangeEnd
          );

          return {
            rank: 0,
            name: client.company_name,
            achievement: clientAchievement(valid.length, client.seats_purchased, bizDays),
            appointments: valid.length,
            seats: client.seats_purchased,
          };
        })
        .sort((a, b) => b.achievement - a.achievement)
        .map((entry, i) => ({ ...entry, rank: i + 1 }));

      // Agent leaderboard
      const agentMap = new Map<string, { setter: string; company: string; appts: number }>();

      for (const client of allClients) {
        if (filters.selectedClients.length > 0 && !filters.selectedClients.includes(client.company_id)) continue;

        const companyAppts = groups.get(client.company_id) ?? [];

        // Active setters in range
        const activeSetters = new Set<string>();
        companyAppts.forEach((a) => {
          if (a.setter_name?.trim() && a.created_at) {
            const d = new Date(a.created_at);
            if (d >= rangeStart && d <= rangeEnd) {
              activeSetters.add(a.setter_name.trim());
            }
          }
        });

        for (const setter of activeSetters) {
          const valid = companyAppts.filter(
            (a) =>
              a.setter_name?.trim() === setter &&
              isValidAppointment(a) &&
              a.created_at &&
              new Date(a.created_at) >= rangeStart &&
              new Date(a.created_at) <= rangeEnd
          );

          if (valid.length === 0) continue;

          const key = `${setter}__${client.company_id}`;
          agentMap.set(key, {
            setter,
            company: client.company_name,
            appts: valid.length,
          });
        }
      }

      const agentEntries: LeaderboardEntry[] = Array.from(agentMap.values())
        .map((a) => ({
          rank: 0,
          name: a.setter,
          companyName: a.company,
          achievement: agentAchievement(a.appts, bizDays),
          appointments: a.appts,
          weeklyAvg: weeklyAverage(a.appts, weeks),
        }))
        .sort((a, b) => b.achievement - a.achievement)
        .map((entry, i) => ({ ...entry, rank: i + 1 }));

      setTopClients(clientEntries);
      setTopAgents(agentEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch leaderboard");
    } finally {
      setLoading(false);
    }
  }, [filters, userRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("leaderboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments_new" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { topClients, topAgents, loading, error, refetch: fetchData };
}
