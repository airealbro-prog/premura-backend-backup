import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  isValidAppointment,
  clientAchievement,
  agentAchievement,
  weeklyAverage,
} from "../lib/calculations";
import { countBusinessDays, getElapsedWeeks } from "../lib/dateUtils";
import type { Appointment, Client, ClientMetrics, AgentMetrics, FilterState } from "../types";

export function useClients(filters: FilterState) {
  const [clients, setClients] = useState<ClientMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [clientsRes, appointmentsRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("appointments_new").select("*"),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      const allClients: Client[] = clientsRes.data ?? [];
      const appointments: Appointment[] = appointmentsRes.data ?? [];
      const { start: rangeStart, end: rangeEnd } = filters.dateRange;
      const bizDays = countBusinessDays(rangeStart, rangeEnd);
      const weeks = getElapsedWeeks(rangeStart, rangeEnd);

      const clientMetrics: ClientMetrics[] = allClients
        .filter((c) => {
          if (filters.selectedClients.length > 0) {
            return filters.selectedClients.includes(c.company_id);
          }
          return true;
        })
        .map((client) => {
          const companyAppointments = appointments.filter(
            (a) => a.company_id === client.company_id
          );

          // Filter to date range by disposition_date
          const rangeAppointments = companyAppointments.filter((a) => {
            if (!a.disposition_date) return false;
            const d = new Date(a.disposition_date);
            return d >= rangeStart && d <= rangeEnd;
          });

          // Valid appointments (not DQ'd) in range
          const validAppointments = rangeAppointments.filter(isValidAppointment);

          // Active agents: distinct setter_names with disposition_date in date range
          const activeSetters = new Set<string>();
          rangeAppointments.forEach((a) => {
            if (a.setter_name && a.disposition_date) {
              activeSetters.add(a.setter_name);
            }
          });

          // Agent-level metrics
          const agents: AgentMetrics[] = Array.from(activeSetters).map((setterName) => {
            const agentValidAppts = validAppointments.filter(
              (a) => a.setter_name === setterName
            );
            const agentAllLeads = rangeAppointments.filter(
              (a) => a.setter_name === setterName
            );
            const apptCount = agentValidAppts.length;

            return {
              setterName,
              companyId: client.company_id,
              companyName: client.company_name,
              appointmentsBooked: apptCount,
              weeklyAvg: weeklyAverage(apptCount, weeks),
              achievement: agentAchievement(apptCount, bizDays),
              totalLeads: agentAllLeads.length,
            };
          });

          // Filter agents by achievement tier
          const filteredAgents =
            filters.achievementTier === "all"
              ? agents
              : agents.filter((a) => {
                  const pct = a.achievement;
                  switch (filters.achievementTier) {
                    case "blue": return pct > 100;
                    case "green": return pct >= 85 && pct <= 100;
                    case "yellow": return pct >= 60 && pct < 85;
                    case "red": return pct < 60;
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
            totalLeads: rangeAppointments.length,
            agents: filteredAgents,
          };
        });

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
                case "blue": return pct > 100;
                case "green": return pct >= 85 && pct <= 100;
                case "yellow": return pct >= 60 && pct < 85;
                case "red": return pct < 60;
                default: return true;
              }
            });

      setClients(tierFiltered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

  return { clients, loading, error, refetch: fetchData };
}
