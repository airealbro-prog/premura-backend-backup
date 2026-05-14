import { useEffect, useState } from 'react';
import { Ticket, CheckCircle2, Clock, AlertTriangle, FileText, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { TicketStatus, TicketPriority } from '@/types';

interface TicketRow {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  client_id: string | null;
  assignee?: { name: string } | null;
  creator?: { name: string } | null;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
}

function StatCard({ label, value, icon, color, borderColor }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4"
      style={{ background: '#16213e', border: `1px solid ${borderColor}` }}
    >
      <div className="rounded-lg p-2.5" style={{ background: color + '22' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function priorityColor(p: TicketPriority) {
  if (p === 'critical') return '#ef4444';
  if (p === 'high') return '#f97316';
  if (p === 'medium') return '#eab308';
  return '#6b7280';
}

function statusColor(s: TicketStatus) {
  if (s === 'open') return '#00d4ff';
  if (s === 'in_progress') return '#a78bfa';
  if (s === 'resolved') return '#22c55e';
  return '#6b7280';
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TROverview() {
  const { isAdmin, userRole } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase
        .from('tickets')
        .select('id, title, status, priority, created_at, updated_at, assigned_to, client_id, assignee:employees!tickets_assigned_to_fkey(name), creator:employees!tickets_created_by_fkey(name)');

      if (!isAdmin && userRole?.company_id) {
        q = q.eq('client_id', userRole.company_id);
      }

      const { data } = await q;
      setTickets((data as TicketRow[]) ?? []);

      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('eod_all_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('date', today);
      setReportCount(count ?? 0);
      setLoading(false);
    }
    load();
  }, [isAdmin, userRole?.company_id]);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const open = tickets.filter(t => t.status === 'open').length;
  const inProgress = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedThisWeek = tickets.filter(t => t.status === 'resolved' && t.updated_at >= weekAgo).length;
  const critical = tickets.filter(t => t.priority === 'critical' && t.status !== 'resolved' && t.status !== 'closed').length;

  const recent = [...tickets].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tickets & Reports</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of active tickets and today's submissions</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Tickets" value={open} icon={<Ticket size={18} />} color="#00d4ff" borderColor="rgba(0,212,255,0.2)" />
        <StatCard label="In Progress" value={inProgress} icon={<Clock size={18} />} color="#a78bfa" borderColor="rgba(167,139,250,0.2)" />
        <StatCard label="Resolved This Week" value={resolvedThisWeek} icon={<CheckCircle2 size={18} />} color="#22c55e" borderColor="rgba(34,197,94,0.2)" />
        <StatCard label="Critical Open" value={critical} icon={<AlertTriangle size={18} />} color="#ef4444" borderColor="rgba(239,68,68,0.2)" />
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard label="Total Tickets" value={tickets.length} icon={<TrendingUp size={18} />} color="#7b2ff7" borderColor="rgba(123,47,247,0.2)" />
        <StatCard label="Reports Submitted Today" value={reportCount} icon={<FileText size={18} />} color="#f97316" borderColor="rgba(249,115,22,0.2)" />
        {isAdmin && (
          <StatCard
            label="Employees with Open Tickets"
            value={new Set(tickets.filter(t => t.status === 'open' && t.assigned_to).map(t => t.assigned_to)).size}
            icon={<Users size={18} />}
            color="#06b6d4"
            borderColor="rgba(6,182,212,0.2)"
          />
        )}
      </div>

      {/* Recent activity */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tickets yet</div>
          ) : (
            recent.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: priorityColor(t.priority) }} />
                  <span className="text-sm text-foreground truncate">{t.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: statusColor(t.status) + '22', color: statusColor(t.status) }}>
                    {t.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(t.updated_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
