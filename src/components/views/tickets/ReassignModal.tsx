import { useState } from 'react';
import { X, UserCheck } from 'lucide-react';
import type { Employee, Ticket } from '@/types';

interface Props {
  ticket: Ticket;
  employees: Employee[];
  currentEmployeeId: string;
  onConfirm: (newAssigneeId: string, note: string) => Promise<void>;
  onClose: () => void;
}

export default function ReassignModal({ ticket, employees, onConfirm, onClose }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const options = employees.filter((e) => e.id !== ticket.assigned_to);

  async function handleConfirm() {
    if (!selectedId) { setError('Please select an employee.'); return; }
    setSaving(true);
    await onConfirm(selectedId, note);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#16213e', border: '1px solid rgba(0,212,255,0.2)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserCheck size={18} style={{ color: '#00d4ff' }} />
            <h2 className="text-base font-semibold text-primary">Reassign Ticket</h2>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary"><X size={18} /></button>
        </div>

        <div className="mb-4 px-3 py-2.5 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="font-medium text-primary">{ticket.title}</p>
          {ticket.assignee && (
            <p className="text-secondary text-xs mt-0.5">Currently assigned to: {ticket.assignee.name}</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-secondary block mb-1.5">Reassign to</label>
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setError(''); }}
              className="w-full px-3 py-2 rounded-lg text-sm text-primary outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="">Select employee…</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.department ? ` — ${e.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-secondary block mb-1.5">Reason <span className="text-xs">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this ticket being reassigned?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm text-primary outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,212,255,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-secondary" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #7b2ff7, #00d4ff)' }}
            >
              {saving ? 'Reassigning…' : 'Confirm Reassign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
