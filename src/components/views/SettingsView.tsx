import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2 } from "lucide-react";

const statusOptions = ["active", "paused", "churned"] as const;

export function SettingsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRow, setNewRow] = useState({
    company_id: "",
    company_name: "",
    seats_purchased: 1,
    status: "active" as Client["status"],
    onboarding_date: "",
    launch_date: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("company_name");
    setClients(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleUpdate = async (id: string, field: string, value: string | number) => {
    await supabase.from("clients").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
    fetchClients();
  };

  const handleAdd = async () => {
    if (!newRow.company_id || !newRow.company_name) return;
    setSaving(true);
    await supabase.from("clients").insert({
      company_id: newRow.company_id,
      company_name: newRow.company_name,
      seats_purchased: newRow.seats_purchased,
      status: newRow.status,
      onboarding_date: newRow.onboarding_date || null,
      launch_date: newRow.launch_date || null,
      contact_email: newRow.contact_email || null,
      contact_phone: newRow.contact_phone || null,
      notes: newRow.notes || null,
    });
    setNewRow({
      company_id: "", company_name: "", seats_purchased: 1, status: "active",
      onboarding_date: "", launch_date: "", contact_email: "", contact_phone: "", notes: "",
    });
    setSaving(false);
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    fetchClients();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="p-6"
    >
      <h1 className="text-xl font-bold gradient-text mb-1">Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage client onboarding, seat allocations, and status.
      </p>

      {/* Existing Clients */}
      <div className="glass-card overflow-x-auto mb-6">
        <div className="grid grid-cols-8 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30 min-w-[900px]">
          <div>Company ID</div>
          <div>Company Name</div>
          <div>Seats</div>
          <div>Status</div>
          <div>Launch Date</div>
          <div>Email</div>
          <div>Phone</div>
          <div></div>
        </div>
        {clients.map((client) => (
          <div key={client.id} className="grid grid-cols-8 gap-2 px-4 py-3 items-center border-b border-border min-w-[900px]">
            <div className="text-sm text-muted-foreground tabular-nums truncate" title={client.company_id}>
              {client.company_id}
            </div>
            <div className="text-sm font-medium text-foreground truncate">{client.company_name}</div>
            <div>
              <input
                type="number"
                min={1}
                value={client.seats_purchased}
                onChange={(e) => handleUpdate(client.id, "seats_purchased", parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <select
                value={client.status}
                onChange={(e) => handleUpdate(client.id, "status", e.target.value)}
                className="px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="date"
                value={client.launch_date ?? ""}
                onChange={(e) => handleUpdate(client.id, "launch_date", e.target.value)}
                className="px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <input
                type="text"
                value={client.contact_email ?? ""}
                onChange={(e) => handleUpdate(client.id, "contact_email", e.target.value)}
                placeholder="email"
                className="w-full px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <input
                type="text"
                value={client.contact_phone ?? ""}
                onChange={(e) => handleUpdate(client.id, "contact_phone", e.target.value)}
                placeholder="phone"
                className="w-full px-2 py-1 text-sm rounded-md border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="text-right">
              <button
                onClick={() => handleDelete(client.id)}
                className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete client"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Client */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Add New Client
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Company ID (GHL Location)</label>
            <input
              type="text"
              value={newRow.company_id}
              onChange={(e) => setNewRow({ ...newRow, company_id: e.target.value })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
              placeholder="e.g. loc_abc123"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Company Name</label>
            <input
              type="text"
              value={newRow.company_name}
              onChange={(e) => setNewRow({ ...newRow, company_name: e.target.value })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
              placeholder="e.g. Acme Solar"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Seats Purchased</label>
            <input
              type="number"
              min={1}
              value={newRow.seats_purchased}
              onChange={(e) => setNewRow({ ...newRow, seats_purchased: parseInt(e.target.value) || 1 })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select
              value={newRow.status}
              onChange={(e) => setNewRow({ ...newRow, status: e.target.value as Client["status"] })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Onboarding Date</label>
            <input
              type="date"
              value={newRow.onboarding_date}
              onChange={(e) => setNewRow({ ...newRow, onboarding_date: e.target.value })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Launch Date</label>
            <input
              type="date"
              value={newRow.launch_date}
              onChange={(e) => setNewRow({ ...newRow, launch_date: e.target.value })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Contact Email</label>
            <input
              type="email"
              value={newRow.contact_email}
              onChange={(e) => setNewRow({ ...newRow, contact_email: e.target.value })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
              placeholder="client@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Contact Phone</label>
            <input
              type="text"
              value={newRow.contact_phone}
              onChange={(e) => setNewRow({ ...newRow, contact_phone: e.target.value })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <input
              type="text"
              value={newRow.notes}
              onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
              className="w-full rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 px-3 py-2 text-sm"
              placeholder="Optional notes..."
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !newRow.company_id || !newRow.company_name}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white gradient-bg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Client
          </button>
        </div>
      </div>
    </motion.div>
  );
}
