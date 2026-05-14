import { useState, useMemo, useEffect } from 'react';
import { ListTodo, AlertTriangle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTickets } from '@/hooks/useTickets';
import { useEmployees } from '@/hooks/useEmployees';
import TicketCard from '@/components/views/tickets/TicketCard';
import type { Employee, TicketPriority, TicketStatus } from '@/types';

const PRIORITY_ORDER: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_COLOR: Record<TicketPriority, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280',
};

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline + 'T23:59:59') < new Date();
}

export function TRQueue() {
  const { isAdmin, user } = useAuth();
  const { employees } = useEmployees();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.email) return;
    supabase.from('employees').select('*').eq('email', user.email).maybeSingle().then(({ data }) => {
      setCurrentEmployee(data ?? null);
    });
  }, [user?.email]);

  const { tickets, loading, updateTicket, reassignTicket } = useTickets({
    assignedTo: isAdmin ? undefined : currentEmployee?.id,
    isAdmin,
  });

  const activeTickets = useMemo(
    () => tickets.filter(t => t.status === 'open' || t.status === 'in_progress'),
    [tickets]
  );

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (isAdmin) {
    // Admin view: grouped by employee
    const byEmployee = employees.map(emp => ({
      emp,
      tickets: activeTickets
        .filter(t => t.assigned_to === emp.id)
        .sort((a, b) => {
          const pi = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
          if (pi !== 0) return pi;
          return a.deadline && b.deadline ? a.deadline.localeCompare(b.deadline) : a.deadline ? -1 : 1;
        }),
    })).filter(g => g.tickets.length > 0);

    const unassigned = activeTickets.filter(t => !t.assigned_to);

    return (
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">All Queues</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{activeTickets.length} active ticket{activeTickets.length !== 1 ? 's' : ''} across all employees</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
        ) : activeTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <ListTodo size={32} className="opacity-30" />
            <p className="text-sm">No active tickets</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {byEmployee.map(({ emp, tickets: empTickets }) => {
              const key = emp.id;
              const collapsed = collapsedGroups.has(key);
              const overdueCount = empTickets.filter(t => isOverdue(t.deadline)).length;
              return (
                <div key={key}>
                  <button
                    onClick={() => toggleGroup(key)}
                    className="flex items-center gap-3 mb-3 w-full text-left"
                  >
                    {collapsed ? <ChevronRight size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    <span className="font-semibold text-foreground">{emp.name}</span>
                    {emp.department && <span className="text-xs text-muted-foreground">{emp.department}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                      {empTickets.length}
                    </span>
                    {overdueCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        <AlertTriangle size={10} /> {overdueCount} overdue
                      </span>
                    )}
                  </button>
                  {!collapsed && (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                      {empTickets.map(ticket => (
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
              );
            })}

            {unassigned.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-semibold text-muted-foreground">Unassigned</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{unassigned.length}</span>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {unassigned.map(ticket => (
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
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Employee view: their own queue sorted by priority + deadline
  const myTickets = activeTickets.sort((a, b) => {
    if (isOverdue(a.deadline) && !isOverdue(b.deadline)) return -1;
    if (!isOverdue(a.deadline) && isOverdue(b.deadline)) return 1;
    const pi = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (pi !== 0) return pi;
    return a.deadline && b.deadline ? a.deadline.localeCompare(b.deadline) : a.deadline ? -1 : 1;
  });

  const statusIcon = (s: TicketStatus) => {
    if (s === 'open') return <Clock size={12} style={{ color: '#00d4ff' }} />;
    if (s === 'in_progress') return <CheckCircle2 size={12} style={{ color: '#a78bfa' }} />;
    return <XCircle size={12} style={{ color: '#6b7280' }} />;
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">My Queue</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{myTickets.length} active ticket{myTickets.length !== 1 ? 's' : ''} assigned to you</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
      ) : myTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <ListTodo size={32} className="opacity-30" />
          <p className="text-sm">Your queue is empty</p>
        </div>
      ) : (
        <>
          {/* Quick summary strip */}
          <div className="flex items-center gap-3 flex-wrap">
            {PRIORITY_ORDER.map(p => {
              const count = myTickets.filter(t => t.priority === p).length;
              if (!count) return null;
              return (
                <div key={p} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: PRIORITY_COLOR[p] + '15', color: PRIORITY_COLOR[p], border: `1px solid ${PRIORITY_COLOR[p]}30` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLOR[p] }} />
                  {count} {p}
                </div>
              );
            })}
            {myTickets.some(t => isOverdue(t.deadline)) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle size={11} /> {myTickets.filter(t => isOverdue(t.deadline)).length} overdue
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {myTickets.map(ticket => (
              <div key={ticket.id} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${PRIORITY_COLOR[ticket.priority]}` }}>
                <div className="flex items-center gap-2 shrink-0">
                  {statusIcon(ticket.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.description}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {isOverdue(ticket.deadline) && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Overdue</span>
                  )}
                  {ticket.deadline && !isOverdue(ticket.deadline) && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
