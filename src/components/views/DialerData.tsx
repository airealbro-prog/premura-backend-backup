import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { StatCard } from "@/components/shared/StatCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { Loader2, Phone, Users, CalendarCheck, TrendingUp, Check, X } from "lucide-react";
import type { DateRange } from "@/types";

interface DialerKpi {
  id: string;
  agent_name: string;
  dial_date: string;
  attended: boolean;
  ready_time_minutes: number;
  avg_ready_time_minutes: number;
  avg_talk_time_minutes: number;
  avg_wrap_time_minutes: number;
  total_calls: number;
  callbacks: number;
  appointments: number;
  conversion_rate: number;
}

interface DialerDataProps {
  dateRange: DateRange;
}

function fmtMin(mins: number): string {
  if (mins < 60) return `${mins.toFixed(0)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function DialerData({ dateRange: _dateRange }: DialerDataProps) {
  const [data, setData] = useState<DialerKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows } = await supabase
        .from("dialer_kpis")
        .select("*")
        .eq("dial_date", selectedDate)
        .order("agent_name");
      setData((rows as DialerKpi[]) ?? []);
    } catch {
      // Table may not exist yet
      setData([]);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = useMemo(() => {
    const totalAgents = data.filter((d) => d.attended).length;
    const totalCalls = data.reduce((s, d) => s + d.total_calls, 0);
    const totalAppts = data.reduce((s, d) => s + d.appointments, 0);
    const avgConv = data.length > 0
      ? data.reduce((s, d) => s + d.conversion_rate, 0) / data.length
      : 0;
    return { totalAgents, totalCalls, totalAppts, avgConv };
  }, [data]);

  return (
    <TooltipProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <div className="px-4 pt-4 space-y-4">
          {/* Date picker */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-border bg-card text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Users size={18} className="text-primary" />} label="Agents Dialing" value={summary.totalAgents} accentColor="#8851F4" />
            <StatCard icon={<Phone size={18} className="text-blue-400" />} label="Total Calls" value={summary.totalCalls} accentColor="#3b82f6" />
            <StatCard icon={<CalendarCheck size={18} className="text-amber-400" />} label="Appointments Set" value={summary.totalAppts} accentColor="#f59e0b" />
            <StatCard icon={<TrendingUp size={18} className="text-blue-400" />} label="Avg Conv. Rate" value={`${summary.avgConv.toFixed(1)}%`} accentColor="#3b82f6" />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Phone size={40} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">No dialer data for {selectedDate}.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Data will appear here once imported from the dialer system.</p>
            </div>
          ) : (
            <div className="glass-card overflow-x-auto">
              <div className="grid grid-cols-10 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20 min-w-[900px]">
                <div className="col-span-2">Agent Name</div>
                <div className="text-center">Attendance</div>
                <div className="text-center">Ready Time</div>
                <div className="text-center">Total Calls</div>
                <div className="text-center">Callbacks</div>
                <div className="text-center">Appts</div>
                <div className="text-center">Avg Talk</div>
                <div className="text-center">Avg Wrap</div>
                <div className="text-center">Conv %</div>
              </div>
              {data.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-10 gap-2 px-4 py-2.5 items-center border-t border-border hover:bg-muted/20 transition-colors min-w-[900px]"
                >
                  <div className="col-span-2 text-sm font-medium text-foreground truncate">{row.agent_name}</div>
                  <div className="flex justify-center">
                    {row.attended ? (
                      <Check size={16} className="text-blue-400" />
                    ) : (
                      <X size={16} className="text-red-400" />
                    )}
                  </div>
                  <div className="text-center text-sm text-muted-foreground tabular-nums">{fmtMin(row.ready_time_minutes)}</div>
                  <div className="text-center text-sm font-semibold text-foreground tabular-nums">{row.total_calls}</div>
                  <div className="text-center text-sm text-muted-foreground tabular-nums">{row.callbacks}</div>
                  <div className="text-center text-sm font-semibold text-foreground tabular-nums">{row.appointments}</div>
                  <div className="text-center text-sm text-muted-foreground tabular-nums">{fmtMin(row.avg_talk_time_minutes)}</div>
                  <div className="text-center text-sm text-muted-foreground tabular-nums">{fmtMin(row.avg_wrap_time_minutes)}</div>
                  <div className="text-center text-sm font-semibold text-foreground tabular-nums">{row.conversion_rate.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
