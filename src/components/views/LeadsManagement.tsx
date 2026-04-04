import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getEffectiveDateRange, getEarliestDate, toInputDate } from "@/lib/dateUtils";
import type { Appointment, DateRange } from "@/types";
import {
  Loader2,
  Copy,
  Check,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  X,
  Columns3,
} from "lucide-react";

interface LeadsManagementProps {
  dateRange: DateRange;
}

interface ColumnDef {
  key: string;
  label: string;
  permKey?: "can_view_contacts" | "can_view_recordings" | "can_view_credit_scores";
  defaultVisible: boolean;
  hideForClient?: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Lead Name", defaultVisible: true },
  { key: "recording_media_link", label: "Recording", permKey: "can_view_recordings", defaultVisible: true },
  { key: "Company Name", label: "Company Name", defaultVisible: true, hideForClient: true },
  { key: "booked_for", label: "Booked For", defaultVisible: true },
  { key: "setter_name", label: "Setter", defaultVisible: true },
  { key: "phone_number", label: "Phone", permKey: "can_view_contacts", defaultVisible: true },
  { key: "email", label: "Email", permKey: "can_view_contacts", defaultVisible: true },
  { key: "notes", label: "Notes", defaultVisible: true },
  { key: "address", label: "Address", defaultVisible: true },
  { key: "credit_score", label: "Credit Score", permKey: "can_view_credit_scores", defaultVisible: true },
  { key: "roof_type", label: "Roof Type", defaultVisible: false },
  { key: "existing_solar", label: "Existing Solar", defaultVisible: false },
  { key: "shading", label: "Shading", defaultVisible: false },
  { key: "closer_name", label: "Closer", defaultVisible: true },
  { key: "disposition_date", label: "Disposition Date", defaultVisible: false },
  { key: "dq_reason", label: "DQ Reason", defaultVisible: false },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-primary transition-colors inline-flex"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-blue-400" /> : <Copy size={12} />}
    </button>
  );
}

function formatBookedFor(raw: string | null): string {
  if (!raw) return "\u2014";
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  } catch { /* fall through */ }
  return raw;
}

function parseRecordingUrl(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
        return arr[0];
      }
    } catch { /* fall through */ }
  }
  return trimmed;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AudioPlayerProps {
  url: string;
  leadName: string;
  onClose: () => void;
}

function AudioPlayer({ url, leadName, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  // Auto-play when URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    audio.play().catch(() => {});
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleClose = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    onClose();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-4"
      style={{ background: "#1e293b" }}
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white hover:bg-primary/80 transition-colors shrink-0"
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      {/* Lead name */}
      <div className="text-sm text-foreground font-medium truncate min-w-[100px] max-w-[180px]">
        {leadName}
      </div>

      {/* Time current */}
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right shrink-0">
        {formatTime(currentTime)}
      </span>

      {/* Seek bar */}
      <div className="flex-1 relative h-5 flex items-center">
        {/* Track bg */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted/40" />
        {/* Track fill */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
        {/* Invisible range input for seeking */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: "20px" }}
        />
        {/* Thumb dot */}
        <div
          className="absolute w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm pointer-events-none"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Time total */}
      <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
        {formatTime(duration)}
      </span>

      {/* Close */}
      <button
        onClick={handleClose}
        className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Close player"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function LeadsManagement({ dateRange }: LeadsManagementProps) {
  const { userRole, isAdmin, hasPermission } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>("");

  // Audio player state
  const [playerTrack, setPlayerTrack] = useState<{ url: string; leadName: string } | null>(null);

  const isClientUser = userRole?.role === "client";

  const permittedColumns = useMemo(() => {
    return ALL_COLUMNS.filter((col) => {
      if (col.hideForClient && isClientUser) return false;
      if (!col.permKey) return true;
      return isAdmin || hasPermission(col.permKey);
    });
  }, [isAdmin, hasPermission, isClientUser]);

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    return new Set(permittedColumns.filter((c) => c.defaultVisible).map((c) => c.key));
  });

  const visibleColumns = useMemo(
    () => permittedColumns.filter((c) => visibleKeys.has(c.key)),
    [permittedColumns, visibleKeys]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("appointments_new").select("*");
      // Client users only see their own company's data
      if (isClientUser && userRole?.company_id) {
        query = query.eq("company_id", userRole.company_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setAppointments((data as Appointment[]) ?? []);
    } catch (err) {
      console.error("[LeadsManagement] fetch error:", err);
    }
    setLoading(false);
  }, [isClientUser, userRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments_new" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filteredByDate = useMemo(() => {
    const earliest = getEarliestDate(appointments);
    const { start, end } = getEffectiveDateRange(dateRange.start, dateRange.end, earliest);
    return appointments.filter((a) => {
      if (!a.created_at) return false;
      const d = new Date(a.created_at);
      return d >= start && d <= end;
    });
  }, [appointments, dateRange]);

  const filteredByRole = useMemo(() => {
    if (isAdmin || !isClientUser) return filteredByDate;
    const companyId = userRole?.company_id;
    if (!companyId) return [];
    return filteredByDate.filter((a) => a.company_id === companyId);
  }, [filteredByDate, isAdmin, isClientUser, userRole]);

  const filtered = useMemo(() => {
    if (!clientFilter) return filteredByRole;
    return filteredByRole.filter((a) => a["Company Name"] === clientFilter);
  }, [filteredByRole, clientFilter]);

  const companyNames = useMemo(() => {
    const names = new Set<string>();
    filteredByRole.forEach((a) => {
      if (a["Company Name"]) names.add(a["Company Name"]);
    });
    return Array.from(names).sort();
  }, [filteredByRole]);

  const toggleNote = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const playRecording = (url: string, leadName: string) => {
    setPlayerTrack({ url, leadName });
  };

  const renderCell = (appt: Appointment, col: ColumnDef) => {
    const val = (appt as unknown as Record<string, unknown>)[col.key];
    const str = val != null ? String(val) : "";

    switch (col.key) {
      case "name": {
        const contactUrl = appt.contact_link || "";
        const displayName = str.length > 25 ? `${str.slice(0, 25)}...` : str;
        if (contactUrl) {
          return (
            <a
              href={contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
              title={str || "Open in GoHighLevel"}
            >
              {displayName || "\u2014"}
            </a>
          );
        }
        return <span className="font-medium text-foreground" title={str}>{displayName || "\u2014"}</span>;
      }

      case "booked_for":
        return <span>{formatBookedFor(str || null)}</span>;

      case "phone_number":
        return str ? (
          <span className="flex items-center gap-1">
            {str}
            <CopyButton text={str} />
          </span>
        ) : "\u2014";

      case "email":
        return str ? (
          <span className="flex items-center gap-1">
            <span className="truncate max-w-[160px]">{str}</span>
            <CopyButton text={str} />
          </span>
        ) : "\u2014";

      case "notes":
        if (!str) return "\u2014";
        const isExpanded = expandedNotes.has(appt.id);
        if (str.length <= 50) return <span>{str}</span>;
        return (
          <button
            onClick={() => toggleNote(appt.id)}
            className="text-left hover:text-primary transition-colors"
          >
            {isExpanded ? str : `${str.slice(0, 50)}...`}
          </button>
        );

      case "recording_media_link": {
        const url = parseRecordingUrl(str);
        return url ? (
          <button
            onClick={() => playRecording(url, appt.name || "Unknown")}
            className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex"
            title="Play recording"
          >
            <Play size={12} />
          </button>
        ) : "\u2014";
      }

      case "existing_solar":
        if (!str) return "\u2014";
        const isSolar = str.toLowerCase() === "yes" || str.toLowerCase() === "true";
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isSolar ? "bg-orange-500/10 text-orange-400" : "bg-blue-500/10 text-blue-400"
          }`}>
            {isSolar ? "Yes" : "No"}
          </span>
        );

      default:
        return <span>{str || "\u2014"}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold text-primary mb-1">Leads Management</h1>
        <p className="text-muted-foreground text-sm">
          View and manage all appointment leads.
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
        {!isClientUser && (
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Companies</option>
            {companyNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}

        <div className="text-xs text-muted-foreground">
          {dateRange.start ? toInputDate(dateRange.start) : "All time"} — {dateRange.end ? toInputDate(dateRange.end) : "Now"}
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs"
          >
            <Columns3 size={14} />
            Columns
            {showColumnPicker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showColumnPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border p-2 shadow-xl max-h-80 overflow-y-auto"
                style={{ background: "#111827" }}
              >
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Toggle Columns</span>
                  <button onClick={() => setShowColumnPicker(false)} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
                {permittedColumns.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted/20 transition-colors"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      visibleKeys.has(col.key) ? "bg-primary border-primary" : "border-border"
                    }`}>
                      {visibleKeys.has(col.key) && <Check size={10} className="text-white" />}
                    </div>
                    {col.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table in fixed-height scrollable container */}
      <div className="glass-card flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border" style={{ background: "#111827" }}>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap ${
                      col.key === "name" ? "sticky left-0 z-30" : ""
                    }`}
                    style={col.key === "name" ? { background: "#111827", maxWidth: "180px" } : { background: "#111827" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-12 text-muted-foreground">
                    No leads found for the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((appt) => (
                  <tr key={appt.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 text-sm text-foreground whitespace-nowrap ${
                          col.key === "name" ? "sticky left-0 z-10 font-medium" : ""
                        } ${col.key === "notes" ? "!whitespace-normal max-w-[250px]" : ""}`}
                        style={col.key === "name" ? { background: "#111827", maxWidth: "180px" } : undefined}
                      >
                        {renderCell(appt, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Inline audio player — fixed to bottom of table container */}
        {playerTrack && (
          <AudioPlayer
            url={playerTrack.url}
            leadName={playerTrack.leadName}
            onClose={() => setPlayerTrack(null)}
          />
        )}
      </div>
    </div>
  );
}
