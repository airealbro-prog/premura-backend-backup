import { useState } from 'react';
import { Calendar, UserCheck, ChevronDown, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Ticket, Employee, TicketPriority, TicketStatus } from '@/types';
import ReassignModal from './ReassignModal';

interface Props {
  ticket: Ticket;
  employees: Employee[];
  isAdmin: boolean;
  currentEmployeeId: string;
  onUpdate: (id: string, values: { priority?: TicketPriority; deadline?: string | null; status?: TicketStatus; assigned_to?: string }) => Promise<{ error: string | null }>;
  onReassign: (ticketId: string, newAssigneeId: string, changedById: string, oldAssigneeId: string | null, note: string) => Promise<{ error: string | null }>;
}

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; bg: string }> = {
  low:      { label: 'Low',      color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  medium:   { label: 'Medium',   color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  high:     { label: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  critical: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open:        { label: 'Open',        color: '#00d4ff', bg: 'rgba(0,212,255,0.12)',    icon: <AlertCircle size={11} /> },
  in_progress: { label: 'In Progress', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: <Clock size={11} /> },
  resolved:    { label: 'Resolved',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',    icon: <CheckCircle size={11} /> },
  closed:      { label: 'Closed',      color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <XCircle size={11} /> },
};

const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open:        ['in_progress', 'closed'],
  in_progress: ['resolved', 'open'],
  resolved:    ['closed', 'open'],
  closed:      ['open'],
};

function formatDeadline(deadline: string | null): { label: string; overdue: boolean } | null {
  if (!deadline) return null;
  const d = new Date(deadline + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: 'Due today', overdue: false };
  if (diff === 1) return { label: 'Due tomorrow', overdue: false };
  return { label: `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, overdue: false };
}

export default function TicketCard({ ticket, employees, isAdmin, currentEmployeeId, onUpdate, onReassign }: Props) {
  const [showReassign, setShowReassign] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(ticket.deadline ?? '');

  const priority = PRIORITY_CONFIG[ticket.priority];
  const status = STATUS_CONFIG[ticket.status];
  const deadlineInfo = formatDeadline(ticket.deadline);
  const canReassign = isAdmin || ticket.assigned_to === currentEmployeeId;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all"
      style={{
        background: '#16213e',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderLeft: `3px solid ${priority.color}`,
      }}
    >
      {/* Top row: priority badge + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority */}
          {isAdmin ? (
            <div className="relative">
              <button
                onClick={() => { setShowPriorityMenu(!showPriorityMenu); setShowStatusMenu(false); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: priority.bg, color: priority.color }}
              >
                {priority.label} <ChevronDown size={10} />
              </button>
              {showPriorityMenu && (
                <div className="absolute top-full left-0 mt-1 rounded-lg overflow-hidden z-10 shadow-xl" style={{ background: '#0f1627', border: '1px solid rgba(255,255,255,0.1)', minWidth: '130px' }}>
                  {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => { onUpdate(ticket.id, { priority: p }); setShowPriorityMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/5"
                      style={{ color: PRIORITY_CONFIG[p].color }}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: priority.bg, color: priority.color }}>
              {priority.label}
            </span>
          )}

          {/* Status */}
          <div className="relative">
            <button
              onClick={() => { setShowStatusMenu(!showStatusMenu); setShowPriorityMenu(false); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: status.bg, color: status.color }}
            >
              {status.icon} {status.label} <ChevronDown size={10} />
            </button>
            {showStatusMenu && (
              <div className="absolute top-full left-0 mt-1 rounded-lg overflow-hidden z-10 shadow-xl" style={{ background: '#0f1627', border: '1px solid rgba(255,255,255,0.1)', minWidth: '140px' }}>
                {STATUS_TRANSITIONS[ticket.status].map((s) => (
                  <button
                    key={s}
                    onClick={() => { onUpdate(ticket.id, { status: s }); setShowStatusMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/5"
                    style={{ color: STATUS_CONFIG[s].color }}
                  >
                    {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Created date */}
        <span className="text-xs text-secondary whitespace-nowrap shrink-0">
          {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Title + description */}
      <div>
        <h3 className="font-semibold text-primary text-sm leading-snug mb-1">{ticket.title}</h3>
        <p className="text-xs text-secondary line-clamp-2 leading-relaxed">{ticket.description}</p>
      </div>

      {/* Deadline */}
      {isAdmin ? (
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-secondary shrink-0" />
          {editingDeadline ? (
            <input
              type="date"
              value={deadlineInput}
              autoFocus
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDeadlineInput(e.target.value)}
              onBlur={() => { onUpdate(ticket.id, { deadline: deadlineInput || null }); setEditingDeadline(false); }}
              className="text-xs text-primary outline-none rounded px-1"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,212,255,0.4)', colorScheme: 'dark' }}
            />
          ) : (
            <button
              onClick={() => setEditingDeadline(true)}
              className="text-xs hover:text-primary transition-colors"
              style={{ color: deadlineInfo?.overdue ? '#ef4444' : deadlineInfo ? '#eab308' : 'rgba(255,255,255,0.4)' }}
            >
              {deadlineInfo ? deadlineInfo.label : 'Set deadline'}
            </button>
          )}
        </div>
      ) : deadlineInfo ? (
        <div className="flex items-center gap-1.5">
          <Calendar size={13} style={{ color: deadlineInfo.overdue ? '#ef4444' : '#eab308' }} />
          <span className="text-xs" style={{ color: deadlineInfo.overdue ? '#ef4444' : '#eab308' }}>
            {deadlineInfo.label}
          </span>
        </div>
      ) : null}

      {/* Meta: created by / assigned to */}
      <div className="flex items-center justify-between gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex flex-col gap-0.5 min-w-0">
          {ticket.creator && (
            <span className="text-xs text-secondary truncate">From: <span className="text-primary">{ticket.creator.name}</span></span>
          )}
          {ticket.assignee && (
            <span className="text-xs text-secondary truncate">To: <span className="text-primary">{ticket.assignee.name}</span>{ticket.assignee.department ? <span className="text-secondary"> · {ticket.assignee.department}</span> : null}</span>
          )}
        </div>

        {canReassign && (
          <button
            onClick={() => setShowReassign(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shrink-0 transition-colors hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          >
            <UserCheck size={12} /> Change Person
          </button>
        )}
      </div>

      {showReassign && (
        <ReassignModal
          ticket={ticket}
          employees={employees}
          currentEmployeeId={currentEmployeeId}
          onConfirm={async (newId, note) => {
            await onReassign(ticket.id, newId, currentEmployeeId, ticket.assigned_to, note);
          }}
          onClose={() => setShowReassign(false)}
        />
      )}
    </div>
  );
}
