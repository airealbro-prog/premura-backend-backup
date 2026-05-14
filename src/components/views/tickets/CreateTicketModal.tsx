import { useState } from 'react';
import { X, Ticket as TicketIcon } from 'lucide-react';
import type { Employee, TicketPriority } from '@/types';

interface Props {
  employees: Employee[];
  currentEmployeeId: string;
  onSave: (values: {
    title: string;
    description: string;
    assigned_to: string;
    priority: TicketPriority;
    deadline: string | null;
    created_by: string;
  }) => Promise<{ error: string | null }>;
  onClose: () => void;
}

const PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#eab308' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'critical', label: 'Critical', color: '#ef4444' },
];

export default function CreateTicketModal({ employees, currentEmployeeId, onSave, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assignedTo) { setError('Please select who this ticket is for.'); return; }
    setSaving(true);
    setError('');
    const { error } = await onSave({
      title,
      description,
      assigned_to: assignedTo,
      priority,
      deadline: deadline || null,
      created_by: currentEmployeeId,
    });
    if (error) { setError(error); setSaving(false); }
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: '#16213e', border: '1px solid rgba(0,212,255,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TicketIcon size={18} style={{ color: '#00d4ff' }} />
            <h2 className="text-base font-semibold text-primary">New Ticket</h2>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-secondary block mb-1.5">Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              required
              className="w-full px-3 py-2 rounded-lg text-sm text-primary outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          <div>
            <label className="text-sm text-secondary block mb-1.5">Problem Description <span className="text-red-400">*</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
              required
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm text-primary outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          <div>
            <label className="text-sm text-secondary block mb-1.5">Assign To <span className="text-red-400">*</span></label>
            <select
              value={assignedTo}
              onChange={(e) => { setAssignedTo(e.target.value); setError(''); }}
              className="w-full px-3 py-2 rounded-lg text-sm text-primary outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.department ? ` — ${e.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-secondary block mb-2">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    border: `1px solid ${priority === p.value ? p.color : 'rgba(255,255,255,0.1)'}`,
                    background: priority === p.value ? `${p.color}20` : 'rgba(255,255,255,0.03)',
                    color: priority === p.value ? p.color : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-secondary block mb-1.5">Deadline <span className="text-xs">(optional)</span></label>
            <input
              type="date"
              value={deadline}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-primary outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-secondary" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #7b2ff7, #00d4ff)' }}>
              {saving ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
