import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  isValidAppointment,
  agentAchievement,
  weeklyAverage,
} from "../lib/calculations";
import { countBusinessDays, getElapsedWeeks, getEffectiveDateRange, getEarliestDate } from "../lib/dateUtils";
import { groupAppointmentsByClient } from "../lib/clientMatch";
import type { Appointment, Client, AgentMetrics, FilterState } from "../types";

interface AgentsByClient {
  companyId: string;
  companyName: string;
  agents: AgentMetrics[];
}

export function useAgents(filters: FilterState) {
  const [agentsByClient, setAgentsByClient] = useState<AgentsByClient[]>([]);
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
      const allAppointments: Appointment[] = appointmentsRes.data ?? [];

      const earliest = getEarliestDate(allAppointments);
      const { start: rangeStart, end: rangeEnd } = getEffectiveDateRange(
        filters.dateRange.start, filters.dateRange.end, earliest
      );
      const bizDays = countBusinessDays(rangeStart, rangeEnd);
      const weeks = getElapsedWeeks(rangeStart, rangeEnd);

      const { groups } = groupAppointmentsByClient(allAppointments, allClients);

      const result: AgentsByClient[] = allClients
        .filter((c) => {
          if (filters.selectedClients.length > 0) {
            return filters.selectedClients.includes(c.company_id);
          }
          return true;
        })
        .map((client) => {
          const companyAppointments = groups.get(client.company_id) ?? [];

          const rangeAppointments = companyAppointments.filter((a) => {
            if (!a.created_at) return false;
            const d = new Date(a.created_at);
            return d >= rangeStart && d <= rangeEnd;
          });

          // Active agents: distinct setter_names with appointments in date range
          const activeSetters = new Set<string>();
          rangeAppointments.forEach((a) => {
            if (a.setter_name) {
              activeSetters.add(a.setter_name);
            }
          });

          const validAppointments = rangeAppointments.filter(isValidAppointment);

          const agents: AgentMetrics[] = Array.from(activeSetters)
            .map((setterName) => {
              const agentAppts = validAppointments.filter((a) => a.setter_name === setterName);
              const agentLeads = rangeAppointments.filter((a) => a.setter_name === setterName);
              const apptCount = agentAppts.length;

              return {
                setterName,
                companyId: client.company_id,
                companyName: client.company_name,
                appointmentsBooked: apptCount,
                weeklyAvg: weeklyAverage(apptCount, weeks),
                achievement: agentAchievement(apptCount, bizDays),
                totalLeads: agentLeads.length,
              };
            })
            .filter((a) => {
              if (filters.searchQuery) {
                return a.setterName.toLowerCase().includes(filters.searchQuery.toLowerCase());
              }
              return true;
            })
            .filter((a) => {
              if (filters.achievementTier === "all") return true;
              const pct = a.achievement;
              switch (filters.achievementTier) {
                case "blue": return pct > 100;
                case "green": return pct >= 85 && pct <= 100;
                case "yellow": return pct >= 60 && pct < 85;
                case "red": return pct < 60;
                default: return true;
              }
            });

          return {
            companyId: client.company_id,
            companyName: client.company_name,
            agents,
          };
        })
        .filter((group) => group.agents.length > 0);

      setAgentsByClient(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("agents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments_new" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { agentsByClient, loading, error, refetch: fetchData };
}
