import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { isValidAppointment, clientAchievement, agentAchievement } from "../lib/calculations";
import { getBusinessWeeks, getMonthRanges, isInRange, countBusinessDays } from "../lib/dateUtils";
import type { Appointment, Client, WeekRange, HistoricalCell, FilterState } from "../types";

export interface HistoricalClientRow {
  companyId: string;
  companyName: string;
  seatsPurchased: number;
  cells: HistoricalCell[];
  agents: HistoricalAgentRow[];
}

export interface HistoricalAgentRow {
  setterName: string;
  cells: HistoricalCell[];
}

export function useHistorical(filters: FilterState, viewMode: "weekly" | "monthly") {
  const [rows, setRows] = useState<HistoricalClientRow[]>([]);
  const [periods, setPeriods] = useState<WeekRange[]>([]);
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

      const timePeriods =
        viewMode === "weekly"
          ? getBusinessWeeks(rangeStart, rangeEnd)
          : getMonthRanges(rangeStart, rangeEnd);

      setPeriods(timePeriods);

      const clientRows: HistoricalClientRow[] = allClients
        .filter((client) => {
          if (filters.selectedClients.length > 0) return filters.selectedClients.includes(client.company_id);
          return true;
        })
        .map((client) => {
          const companyAppts = appointments.filter((a) => a.company_id === client.company_id);
          const validAppts = companyAppts.filter(isValidAppointment);

          // Active agents in global date range
          const activeSetters = new Set<string>();
          companyAppts.forEach((a) => {
            if (a.setter_name && a.created_at) {
              const d = new Date(a.created_at);
              if (d >= rangeStart && d <= rangeEnd) {
                activeSetters.add(a.setter_name);
              }
            }
          });

          const cells: HistoricalCell[] = timePeriods.map((period) => {
            const count = validAppts.filter((a) => {
              if (!a.created_at) return false;
              return isInRange(new Date(a.created_at), period.start, period.end);
            }).length;
            const periodBizDays = countBusinessDays(period.start, period.end);
            return {
              count,
              achievement: clientAchievement(count, client.seats_purchased, periodBizDays),
            };
          });

          const agents: HistoricalAgentRow[] = Array.from(activeSetters)
            .filter((setter) => {
              if (filters.searchQuery) {
                return setter.toLowerCase().includes(filters.searchQuery.toLowerCase());
              }
              return true;
            })
            .map((setter) => {
              const agentAppts = validAppts.filter((a) => a.setter_name === setter);
              const agentCells: HistoricalCell[] = timePeriods.map((period) => {
                const count = agentAppts.filter((a) => {
                  if (!a.created_at) return false;
                  return isInRange(new Date(a.created_at), period.start, period.end);
                }).length;
                const periodBizDays = countBusinessDays(period.start, period.end);
                return {
                  count,
                  achievement: agentAchievement(count, periodBizDays),
                };
              });
              return { setterName: setter, cells: agentCells };
            });

          return {
            companyId: client.company_id,
            companyName: client.company_name,
            seatsPurchased: client.seats_purchased,
            cells,
            agents,
          };
        });

      setRows(clientRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  }, [filters, viewMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("historical-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments_new" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { rows, periods, loading, error, refetch: fetchData };
}
