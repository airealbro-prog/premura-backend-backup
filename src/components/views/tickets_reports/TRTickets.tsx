import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Ticket as TicketIcon, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTickets } from '@/hooks/useTickets';
import { useEmployees } from '@/hooks/useEmployees';
import TicketCard from '@/components/views/tickets/TicketCard';
import CreateTicketModal from '@/components/views/tickets/CreateTicketModal';
import type { Employee, TicketStatus, TicketPriority } from '@/types';

const STATUS_LABELS: Record<TicketStatus | 'all', string> = {
  all: 'All', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
};

export function TRTickets() {
  const { isAdmin, user, userRole } = useAuth();
  const { employees } = useEmployees();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    supabase.from('employees').select('*').eq('email', user.email).maybeSingle().then(({ data }) => {
      setCurrentEmployee(data ?? null);
    });
  }, [user?.email]);

  const isClientUser = userRole?.role === 'client' || (userRole as { role: string } | null)?.role === 'client_admin';

  const { tickets, loading, createTicket, updateTicket, reassignTicket } = useTickets({
    assignedTo: isAdmin ? undefined : currentEmployee?.id,
    isAdmin,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | 'all'>('all');

  const visibleTickets = useMemo(() => {
    if (isClientUser && userRole?.company_id) {
      return tickets.filter(t => (t as unknown as { client_id: string | null }).client_id === userRole.company_id);
    }
    return tickets;
  }, [tickets, isClientUser, userRole?.company_id]);

  const employeeTicketCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of visibleTickets) {
      if (t.assigned_to) counts[t.assigned_to] = (counts[t.assigned_to] ?? 0) + 1;
    }
    return counts;
  }, [visibleTickets]);

  const filtered = useMemo(() => {
    return visibleTickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (selectedEmployeeId !== 'all' && t.assigned_to !== selectedEmployeeId) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [visibleTickets, statusFilter, priorityFilter, selectedEmployeeId, search]);

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Tickets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin
              ? `${visibleTickets.length} total ticket${visibleTickets.length !== 1 ? 's' : ''}`
              : isClientUser
              ? 'Your submitted tickets'
              : 'Your assigned tickets'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #7b2ff7, #8851F4)' }}
        >
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none bg-white/5 border border-white/10 text-foreground focus:border-purple-500/40"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={13} className="text-muted-foreground" />
          {(Object.keys(STATUS_LABELS) as (TicketStatus | 'all')[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: statusFilter === s ? 'rgba(136,81,244,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${statusFilter === s ? 'rgba(136,81,244,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: statusFilter === s ? '#8851F4' : 'rgba(255,255,255,0.5)',
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
          className="px-3 py-1.5 rounded-lg text-xs outline-none bg-white/5 border border-white/[0.08] text-foreground"
        >
          <option value="all">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Employee panel (admin only) */}
        {isAdmin && (
          <div className="w-56 shrink-0 rounded-xl flex flex-col" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Users size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employees</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              <button
                onClick={() => setSelectedEmployeeId('all')}
                className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors"
                style={{ background: selectedEmployeeId === 'all' ? 'rgba(136,81,244,0.1)' : 'transparent', color: selectedEmployeeId === 'all' ? '#8851F4' : 'rgba(255,255,255,0.7)' }}
              >
                <span className="font-medium">All</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>{visibleTickets.length}</span>
              </button>
              {employees.map((emp) => {
                const count = employeeTicketCounts[emp.id] ?? 0;
                const active = selectedEmployeeId === emp.id;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors"
                    style={{ background: active ? 'rgba(136,81,244,0.1)' : 'transparent', color: active ? '#8851F4' : 'rgba(255,255,255,0.7)' }}
                  >
                    <span className="truncate text-left">{emp.name}</span>
                    {count > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 ml-1" style={{ background: active ? 'rgba(136,81,244,0.2)' : 'rgba(255,255,255,0.1)', color: active ? '#8851F4' : 'rgba(255,255,255,0.5)' }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ticket grid */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading tickets…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <TicketIcon size={32} className="opacity-30" />
              <p className="text-sm">No tickets found</p>
              {!search && statusFilter === 'all' && (
                <button onClick={() => setShowCreate(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(136,81,244,0.1)', color: '#8851F4', border: '1px solid rgba(136,81,244,0.2)' }}>
                  Create first ticket
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {filtered.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  employees={employees}
                  isAdmin={isAdmin}
                  currentEmployeeId={currentEmployee?.id ?? ''}
                  onUpdate={updateTicket}
                  onReassign={reassignTicket}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && currentEmployee && (
        <CreateTicketModal
          employees={employees}
          currentEmployeeId={currentEmployee.id}
          onSave={createTicket}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
