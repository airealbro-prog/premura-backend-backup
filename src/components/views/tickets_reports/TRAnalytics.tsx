import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, Clock, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { ShieldX } from 'lucide-react';
import type { TicketStatus, TicketPriority } from '@/types';

interface TicketRow {
  id: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  assignee?: { name: string } | null;
}

interface ReportStat {
  employee_name: string;
  count: number;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

function StatTile({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="rounded-lg p-2 shrink-0" style={{ background: color + '22' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function TRAnalytics() {
  const { isAdmin } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [reportStats, setReportStats] = useState<ReportStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      setLoading(true);
      const { data: tData } = await supabase
        .from('tickets')
        .select('id, status, priority, created_at, updated_at, assigned_to, assignee:employees!tickets_assigned_to_fkey(name)');
      setTickets((tData as unknown as TicketRow[]) ?? []);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: rData } = await supabase
        .from('eod_all_submissions')
        .select('employee_name')
        .gte('date', thirtyDaysAgo);
      if (rData) {
        const counts: Record<string, number> = {};
        for (const r of rData as { employee_name: string }[]) {
          if (r.employee_name) counts[r.employee_name] = (counts[r.employee_name] ?? 0) + 1;
        }
        setReportStats(
          Object.entries(counts)
            .map(([employee_name, count]) => ({ employee_name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        );
      }
      setLoading(false);
    }
    load();
  }, [isAdmin]);

  const ticketsByStatus = useMemo(() => {
    const counts: Record<TicketStatus, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) counts[t.status]++;
    return counts;
  }, [tickets]);

  const ticketsByPriority = useMemo(() => {
    const counts: Record<TicketPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const t of tickets) counts[t.priority]++;
    return counts;
  }, [tickets]);

  const resolutionTimes = useMemo(() => {
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    if (!resolved.length) return null;
    const times = resolved.map(t => new Date(t.updated_at).getTime() - new Date(t.created_at).getTime());
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const avgHours = Math.round(avg / 3600000);
    if (avgHours < 24) return `${avgHours}h`;
    return `${Math.round(avgHours / 24)}d`;
  }, [tickets]);

  const ticketsByEmployee = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const t of tickets) {
      if (t.assigned_to && t.assignee?.name) {
        if (!counts[t.assigned_to]) counts[t.assigned_to] = { name: t.assignee.name, count: 0 };
        counts[t.assigned_to].count++;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [tickets]);

  const maxEmpCount = ticketsByEmployee[0]?.count ?? 1;
  const maxReportCount = reportStats[0]?.count ?? 1;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <ShieldX size={48} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Admin Only</h2>
        <p className="text-sm text-muted-foreground">Analytics are only available to admins.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading analytics…</div>;
  }

  const priorityConfig: { key: TicketPriority; label: string; color: string }[] = [
    { key: 'critical', label: 'Critical', color: '#ef4444' },
    { key: 'high', label: 'High', color: '#f97316' },
    { key: 'medium', label: 'Medium', color: '#eab308' },
    { key: 'low', label: 'Low', color: '#6b7280' },
  ];

  const statusConfig: { key: TicketStatus; label: string; color: string }[] = [
    { key: 'open', label: 'Open', color: '#8851F4' },
    { key: 'in_progress', label: 'In Progress', color: '#a78bfa' },
    { key: 'resolved', label: 'Resolved', color: '#22c55e' },
    { key: 'closed', label: 'Closed', color: '#6b7280' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Ticket and report trends across your team</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Tickets" value={tickets.length} icon={<TrendingUp size={16} />} color="#7b2ff7" />
        <StatTile
          label="Open + In Progress"
          value={ticketsByStatus.open + ticketsByStatus.in_progress}
          sub={`${ticketsByStatus.open} open, ${ticketsByStatus.in_progress} in progress`}
          icon={<AlertTriangle size={16} />}
          color="#f97316"
        />
        <StatTile
          label="Resolved / Closed"
          value={ticketsByStatus.resolved + ticketsByStatus.closed}
          sub={`${Math.round(((ticketsByStatus.resolved + ticketsByStatus.closed) / (tickets.length || 1)) * 100)}% of all tickets`}
          icon={<CheckCircle2 size={16} />}
          color="#22c55e"
        />
        <StatTile
          label="Avg Resolution Time"
          value={resolutionTimes ?? '—'}
          sub={resolutionTimes ? 'from open to resolved/closed' : 'No resolved tickets yet'}
          icon={<Clock size={16} />}
          color="#8851F4"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tickets by priority */}
        <div className="rounded-xl p-5" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Tickets by Priority</h3>
          <div className="flex flex-col gap-3">
            {priorityConfig.map(({ key, label, color }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                </div>
                <Bar value={ticketsByPriority[key]} max={tickets.length || 1} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Tickets by status */}
        <div className="rounded-xl p-5" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Tickets by Status</h3>
          <div className="flex flex-col gap-3">
            {statusConfig.map(({ key, label, color }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                </div>
                <Bar value={ticketsByStatus[key]} max={tickets.length || 1} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Tickets per employee */}
        <div className="rounded-xl p-5" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Tickets per Employee</h3>
          {ticketsByEmployee.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No assigned tickets yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {ticketsByEmployee.map(({ name, count }) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{name}</span>
                  </div>
                  <Bar value={count} max={maxEmpCount} color="#7b2ff7" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report submissions (last 30 days) */}
        <div className="rounded-xl p-5" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-1">Report Submissions</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 30 days, top 10 employees</p>
          {reportStats.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No reports in the last 30 days.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {reportStats.map(({ employee_name, count }) => (
                <div key={employee_name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{employee_name}</span>
                  </div>
                  <Bar value={count} max={maxReportCount} color="#8851F4" />
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <FileText size={12} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{reportStats.reduce((a, b) => a + b.count, 0)} total submissions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
