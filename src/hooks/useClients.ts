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
import type { Appointment, Client, ClientMetrics, AgentMetrics, FilterState } from "@/types";

export function useClients(filters: FilterState) {
  const [clients, setClients] = useState<ClientMetrics[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userRole } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let clientsQuery = supabase.from("clients").select("*").range(0, 49999);
      let appointmentsQuery = supabase.from("appointments_new").select("*").range(0, 49999);

      if ((userRole?.role === "client" || userRole?.role === ("client_admin" as string)) && userRole.company_id) {
        clientsQuery = clientsQuery.eq("company_id", userRole.company_id);
        appointmentsQuery = appointmentsQuery.eq("company_id", userRole.company_id);
      }

      const [clientsRes, appointmentsRes] = await Promise.all([
        clientsQuery,
        appointmentsQuery,
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      const allClients: Client[] = clientsRes.data ?? [];
      const allAppointments: Appointment[] = appointmentsRes.data ?? [];

      const earliest = getEarliestDate(allAppointments);
      const { start: rangeStart, end: rangeEnd } = getEffectiveDateRange(
        filters.dateRange.start, filters.dateRange.end, earliest
      );
      const bizDays = countBusinessDays(rangeStart, rangeEnd);
      const weeks = getElapsedWeeks(rangeStart, rangeEnd);

      // Group appointments by client (with Company Name fallback)
      const { groups } = groupAppointmentsByClient(allAppointments, allClients);

      const clientMetrics: ClientMetrics[] = allClients
        .filter((c) => {
          if (filters.selectedClients.length > 0) {
            return filters.selectedClients.includes(c.company_id);
          }
          return true;
        })
        .map((client) => {
          const companyAppointments = groups.get(client.company_id) ?? [];

          // Filter to date range by created_at
          const rangeAppointments = companyAppointments.filter((a) => {
            if (!a.created_at) return false;
            const d = new Date(a.created_at);
            return d >= rangeStart && d <= rangeEnd;
          });

          // Valid appointments (not DQ'd) in range
          const validAppointments = rangeAppointments.filter(isValidAppointment);

          // Active agents: distinct setter_names with appointments in date range
          const activeSetters = new Set<string>();
          rangeAppointments.forEach((a) => {
            if (a.setter_name?.trim()) {
              activeSetters.add(a.setter_name.trim());
            }
          });

          // Agent-level metrics
          const agents: AgentMetrics[] = Array.from(activeSetters).map((setterName) => {
            const agentValidAppts = validAppointments.filter(
              (a) => a.setter_name?.trim() === setterName
            );
            const apptCount = agentValidAppts.length;

            return {
              setterName,
              companyId: client.company_id,
              companyName: client.company_name,
              appointmentsBooked: apptCount,
              weeklyAvg: weeklyAverage(apptCount, weeks),
              achievement: agentAchievement(apptCount, bizDays),
            };
          });

          // Filter agents by achievement tier
          const filteredAgents =
            filters.achievementTier === "all"
              ? agents
              : agents.filter((a) => {
                  const pct = a.achievement;
                  switch (filters.achievementTier) {
                    case "blue": return pct >= 60;
                    case "orange": return pct >= 30 && pct < 60;
                    case "red": return pct < 30;
                    default: return true;
                  }
                });

          const totalValidAppts = validAppointments.length;

          return {
            companyId: client.company_id,
            companyName: client.company_name,
            status: client.status,
            seatsPurchased: client.seats_purchased,
            activeAgents: activeSetters.size,
            totalAppointments: totalValidAppts,
            achievement: clientAchievement(totalValidAppts, client.seats_purchased, bizDays),
            agents: filteredAgents,
          };
        });

      setTotalClients(clientMetrics.length);

      // Apply search filter
      const filtered = filters.searchQuery
        ? clientMetrics.filter((c) =>
            c.companyName.toLowerCase().includes(filters.searchQuery.toLowerCase())
          )
        : clientMetrics;

      // Apply achievement tier filter at client level
      const tierFiltered =
        filters.achievementTier === "all"
          ? filtered
          : filtered.filter((c) => {
              const pct = c.achievement;
              switch (filters.achievementTier) {
                case "blue": return pct >= 60;
                case "orange": return pct >= 30 && pct < 60;
                case "red": return pct < 30;
                default: return true;
              }
            });

      setClients(tierFiltered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [filters, userRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments_new" },
        () => { fetchData(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { clients, totalClients, loading, error, refetch: fetchData };
}
