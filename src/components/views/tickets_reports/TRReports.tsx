import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, FileText, Search, Calendar, User, LayoutList } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useReports } from '@/hooks/useReports';
import type { ReportRow } from '@/hooks/useReports';
import { format, subDays } from 'date-fns';

function toLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground italic text-xs">—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic text-xs">None</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>
            {String(v)}
          </span>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    return <span className="text-xs text-muted-foreground font-mono">{JSON.stringify(value)}</span>;
  }
  if (typeof value === 'boolean') {
    return <span style={{ color: value ? '#22c55e' : '#ef4444' }} className="text-xs font-medium">{value ? 'Yes' : 'No'}</span>;
  }
  return <span className="text-sm text-foreground">{String(value)}</span>;
}

function FormDataCard({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([k]) => !['id', 'employee_id', 'employee_name', 'submitted_at', 'created_at', 'updated_at', 'date', 'day_of_week'].includes(k)
  );
  if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">No additional data.</p>;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(0,212,255,0.7)' }}>{toLabel(key)}</span>
          <FieldValue value={value} />
        </div>
      ))}
    </div>
  );
}

function ReportRowItem({ report }: { report: ReportRow }) {
  const [expanded, setExpanded] = useState(false);
  const dateLabel = report.date
    ? new Date(report.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const timeLabel = report.submitted_at
    ? new Date(report.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';
  const formLabel = report.form_type
    ? report.form_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown Form';

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,212,255,0.1)' }}>
          <FileText size={14} style={{ color: '#00d4ff' }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">{report.employee_name}</span>
          <span className="text-xs text-muted-foreground truncate block">{report.role}</span>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(123,47,247,0.15)', color: '#a78bfa' }}>
            {formLabel}
          </span>
        </div>
        <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 text-right">
          <span className="text-xs text-foreground">{dateLabel}</span>
          <span className="text-xs text-muted-foreground">{report.day_of_week} · {timeLabel}</span>
        </div>
        <div className="shrink-0 text-muted-foreground ml-2">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="pt-3">
            {report.form_data ? <FormDataCard data={report.form_data} /> : <p className="text-xs text-muted-foreground italic">No form data available.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function TRReports() {
  const { isAdmin, user } = useAuth();
  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedFormType, setSelectedFormType] = useState('all');

  const { reports, loading } = useReports({ dateStart, dateEnd });

  const allReports = useMemo(() => {
    if (isAdmin) return reports;
    return reports.filter(r => r.employee_name?.toLowerCase() === (user?.email?.split('@')[0] ?? '').toLowerCase() || r.employee_id === user?.id);
  }, [reports, isAdmin, user]);

  const employees = useMemo(() => [...new Set(allReports.map(r => r.employee_name).filter(Boolean))].sort(), [allReports]);
  const formTypes = useMemo(() => [...new Set(allReports.map(r => r.form_type).filter(Boolean))].sort(), [allReports]);

  const filtered = useMemo(() => {
    return allReports.filter((r) => {
      if (selectedEmployee !== 'all' && r.employee_name !== selectedEmployee) return false;
      if (selectedFormType !== 'all' && r.form_type !== selectedFormType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.employee_name?.toLowerCase().includes(q) && !r.form_type?.toLowerCase().includes(q) && !r.role?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allReports, selectedEmployee, selectedFormType, search]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin ? 'All employee form submissions' : 'Your submitted forms'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee or form…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-foreground outline-none bg-white/5 border border-white/10 focus:border-cyan-400/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-muted-foreground" />
          <input
            type="date" value={dateStart} max={dateEnd}
            onChange={(e) => setDateStart(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs text-foreground outline-none bg-white/5 border border-white/10"
            style={{ colorScheme: 'dark' }}
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="date" value={dateEnd} min={dateStart} max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => setDateEnd(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs text-foreground outline-none bg-white/5 border border-white/10"
            style={{ colorScheme: 'dark' }}
          />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <User size={13} className="text-muted-foreground" />
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs text-foreground outline-none bg-white/5 border border-white/[0.08]"
            >
              <option value="all">All Employees</option>
              {employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <LayoutList size={13} className="text-muted-foreground" />
          <select
            value={selectedFormType}
            onChange={(e) => setSelectedFormType(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs text-foreground outline-none bg-white/5 border border-white/[0.08]"
          >
            <option value="all">All Forms</option>
            {formTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading reports…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <FileText size={32} className="opacity-30" />
          <p className="text-sm">No submissions found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(report => <ReportRowItem key={report.id} report={report} />)}
        </div>
      )}
    </div>
  );
}
