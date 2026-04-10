import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  isValidAppointment,
  agentAchievement,
  weeklyAverage,
} from "@/lib/calculations";
import { countBusinessDays, getElapsedWeeks, getEffectiveDateRange, getEarliestDate } from "@/lib/dateUtils";
import { startOfDay } from "date-fns";
import { groupAppointmentsByClient } from "@/lib/clientMatch";
import { getClientAppointmentFilter } from "@/lib/clientFilter";
import type { Appointment, Client, AgentMetrics, FilterState } from "@/types";

interface AgentsByClient {
  companyId: string;
  companyName: string;
  agents: AgentMetrics[];
}

interface AgentStartDate {
  agent_name: string;
  company_name: string | null;
  start_date: string;
  status: string;
}

export function useAgents(filters: FilterState) {
  const [agentsByClient, setAgentsByClient] = useState<AgentsByClient[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
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
        console.log("[useAgents] client user filter — company_id:", userRole.company_id);
        clientsQuery = clientsQuery.eq("company_id", userRole.company_id);
        const orFilter = await getClientAppointmentFilter(userRole.company_id);
        if (orFilter) {
          appointmentsQuery = appointmentsQuery.or(orFilter);
        } else {
          console.warn("[useAgents] No OR filter — falling back to company_id equality for:", userRole.company_id);
          appointmentsQuery = appointmentsQuery.eq("company_id", userRole.company_id);
        }
      }

      // Fetch agent start dates (may not exist yet)
      let startDates: AgentStartDate[] = [];
      try {
        const { data: sdData } = await supabase
          .from("agent_start_dates")
          .select("agent_name, company_name, start_date, status");
        if (sdData) startDates = sdData as AgentStartDate[];
      } catch {
        // Table may not exist yet
      }

      // Build lookup: "agentName_companyName" -> start_date
      const startDateMap = new Map<string, Date>();
      for (const sd of startDates) {
        const key = `${sd.agent_name.trim()}_${(sd.company_name || "").trim()}`;
        startDateMap.set(key, new Date(sd.start_date));
        // Also index by agent name only as fallback
        if (!startDateMap.has(sd.agent_name.trim())) {
          startDateMap.set(sd.agent_name.trim(), new Date(sd.start_date));
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

      const earliest = getEarliestDate(allAppointments);
      const { start: rangeStart, end: rangeEnd } = getEffectiveDateRange(
        filters.dateRange.start, filters.dateRange.end, earliest
      );
      const weeks = getElapsedWeeks(rangeStart, rangeEnd);

      const { groups } = groupAppointmentsByClient(allAppointments, allClients);

      // Build a map of first appointment date per agent for fallback
      const firstApptMap = new Map<string, Date>();
      for (const a of allAppointments) {
        if (!a.setter_name || !a.created_at) continue;
        const name = a.setter_name.trim();
        const existing = firstApptMap.get(name);
        const d = new Date(a.created_at);
        if (!existing || d < existing) {
          firstApptMap.set(name, d);
        }
      }

      let allAgentCount = 0;
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
              activeSetters.add(a.setter_name.trim());
            }
          });

          const validAppointments = rangeAppointments.filter(isValidAppointment);

          const allAgents: AgentMetrics[] = Array.from(activeSetters)
            .map((setterName) => {
              const agentAppts = validAppointments.filter((a) => a.setter_name?.trim() === setterName);
              const apptCount = agentAppts.length;

              // Determine agent's effective start date for achievement calc
              const specificKey = `${setterName}_${client.company_name.trim()}`;
              const agentStartDate = startDateMap.get(specificKey)
                ?? startDateMap.get(setterName)
                ?? firstApptMap.get(setterName)
                ?? rangeStart;

              // Effective start = max(agentStartDate, filterRangeStart)
              const effectiveStart = agentStartDate > rangeStart
                ? startOfDay(agentStartDate)
                : rangeStart;
              const agentBizDays = countBusinessDays(effectiveStart, rangeEnd);
              const effectiveBizDays = Math.max(agentBizDays, 1);

              return {
                setterName,
                companyId: client.company_id,
                companyName: client.company_name,
                appointmentsBooked: apptCount,
                weeklyAvg: weeklyAverage(apptCount, weeks),
                achievement: agentAchievement(apptCount, effectiveBizDays),
              };
            });

          allAgentCount += allAgents.length;

          const agents = allAgents
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
                case "blue": return pct >= 60;
                case "orange": return pct >= 30 && pct < 60;
                case "red": return pct < 30;
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

      setTotalAgents(allAgentCount);
      setAgentsByClient(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [filters, userRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("agents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments_new" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { agentsByClient, totalAgents, loading, error, refetch: fetchData };
}
