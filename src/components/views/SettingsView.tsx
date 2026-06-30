import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, startImpersonation } from "@/lib/auth";
import { EmployeeManagement } from "@/components/settings/EmployeeManagement";
import { AgentStartDates } from "@/components/settings/AgentStartDates";
import { relinkAppointmentsToClient, mergeDuplicateClients } from "@/lib/clientSync";
import { isTestClient } from "@/lib/clientVisibility";
import type { Client } from "@/types";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Loader2,
  UserPlus,
  X,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronRight,
  Save,
  UserCheck,
  Mail,
} from "lucide-react";

const statusOptions = ["active", "paused", "churned"] as const;

type SettingsTab = "clients" | "employees" | "agent_dates";

// --- Password helpers (shared with EmployeeManagement) ---
function generatePassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Premura${digits}!`;
}

function validatePassword(pw: string) {
  return {
    minLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
  };
}

function isPasswordValid(pw: string): boolean {
  const v = validatePassword(pw);
  return v.minLength && v.hasUpper && v.hasLower && v.hasNumber;
}

const PASSWORD_RULES: { key: keyof ReturnType<typeof validatePassword>; label: string }[] = [
  { key: "minLength", label: "At least 8 characters" },
  { key: "hasUpper", label: "One uppercase letter" },
  { key: "hasLower", label: "One lowercase letter" },
  { key: "hasNumber", label: "One number" },
];

const CLIENT_PERMISSION_LABELS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: "can_view_overview", label: "Can view Overview", defaultOn: true },
  { key: "can_view_performance", label: "Can view Performance", defaultOn: true },
  { key: "can_view_historical", label: "Can view Historical", defaultOn: true },
  { key: "can_view_contacts", label: "Can view contact info", defaultOn: false },
  { key: "can_view_recordings", label: "Can view recordings", defaultOn: false },
  { key: "can_view_credit_scores", label: "Can view credit scores", defaultOn: false },
  { key: "can_view_commissions", label: "Can view commissions", defaultOn: false },
  { key: "can_view_leads", label: "Can view Leads", defaultOn: true },
];

function getDefaultClientPerms() {
  const perms: Record<string, boolean | string[]> = {
    can_view_overview: true,
    can_view_performance: true,
    can_view_leaderboard: false,
    can_view_historical: true,
    can_view_settings: false,
    can_view_contacts: false,
    can_view_recordings: false,
    can_view_credit_scores: false,
    can_view_commissions: false,
    can_view_all_clients: false,
    can_view_leads: true,
    restricted_client_ids: [],
  };
  return perms;
}

interface ClientUser {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, unknown>;
}

export function SettingsView() {
  const { isAdmin, userRole, hasPermission } = useAuth();
  const isClientAdmin = (userRole as { role: string } | null)?.role === "client_admin";
  const canManageUsers = isClientAdmin && (userRole?.permissions as unknown as Record<string, unknown>)?.can_manage_users === true;
  const [tab, setTab] = useState<SettingsTab>("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Test accounts (ZTEST*, Test Solar, …) are hidden from Client Management by
  // default; admins can reveal them here to manage/unflag without leaving the app.
  const [showTestClients, setShowTestClients] = useState(false);

  // Client user counts per company_id
  const [clientUserCounts, setClientUserCounts] = useState<Record<string, number>>({});

  // Manage Client Access modal
  const [modalClient, setModalClient] = useState<Client | null>(null);
  const [modalUsers, setModalUsers] = useState<ClientUser[]>([]);
  const [modalUsersLoading, setModalUsersLoading] = useState(false);

  // Add user form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<"client" | "client_admin">("client");
  const [formPerms, setFormPerms] = useState<Record<string, boolean | string[]>>(getDefaultClientPerms());
  const [formSending, setFormSending] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  // Edit existing user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editRole, setEditRole] = useState<"client" | "client_admin">("client");
  const [editPerms, setEditPerms] = useState<Record<string, boolean | string[]>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const fetchClientUserCounts = useCallback(async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("company_id")
      .in("role", ["client", "client_admin"]);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((r) => {
        if (r.company_id) counts[r.company_id] = (counts[r.company_id] || 0) + 1;
      });
      setClientUserCounts(counts);
    }
  }, []);

  useEffect(() => { fetchClients(); fetchClientUserCounts(); }, [fetchClients, fetchClientUserCounts]);

  const handleUpdate = async (id: string, field: string, value: string | number) => {
    await supabase.from("clients").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
    // If company_id or company_name changed, re-sync appointment links.
    if (field === "company_id" || field === "company_name") {
      const { data: row } = await supabase
        .from("clients")
        .select("company_id, company_name")
        .eq("id", id)
        .maybeSingle();
      if (row?.company_id && row?.company_name) {
        await relinkAppointmentsToClient(row.company_id, row.company_name);
        await mergeDuplicateClients(row.company_id, row.company_name);
      }
    }
    fetchClients();
  };

  const handleAdd = async () => {
    if (!newRow.company_id || !newRow.company_name) return;
    setSaving(true);
    const { error } = await supabase.from("clients").insert({
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
    if (!error) {
      // Link any existing appointments with the same "Company Name" to this id,
      // and merge any pre-existing auto_* duplicate clients onto this one.
      await relinkAppointmentsToClient(newRow.company_id, newRow.company_name);
      await mergeDuplicateClients(newRow.company_id, newRow.company_name);
    }
    setNewRow({
      company_id: "", company_name: "", seats_purchased: 1, status: "active",
      onboarding_date: "", launch_date: "", contact_email: "", contact_phone: "", notes: "",
    });
    setSaving(false);
    fetchClients();
  };

  const handleDeleteClient = async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    fetchClients();
  };

  // --- Modal ---
  const fetchModalUsers = useCallback(async (companyId: string) => {
    setModalUsersLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id, role, permissions")
      .eq("company_id", companyId)
      .in("role", ["client", "client_admin"])
      .order("created_at", { ascending: true });
    setModalUsers(
      (data ?? []).map((d) => ({
        id: d.id,
        user_id: d.user_id,
        role: d.role,
        permissions: (d.permissions as Record<string, unknown>) ?? {},
      }))
    );
    setModalUsersLoading(false);
  }, []);

  // Auto-load users for client_admin's own company
  useEffect(() => {
    if (isClientAdmin && userRole?.company_id) {
      fetchModalUsers(userRole.company_id);
      setLoading(false);
    }
  }, [isClientAdmin, userRole?.company_id, fetchModalUsers]);

  const openModal = (client: Client) => {
    setModalClient(client);
    setFormName("");
    setFormEmail(client.contact_email ?? "");
    setFormPassword("");
    setShowPassword(false);
    setFormRole("client");
    setFormPerms(getDefaultClientPerms());
    setFormMsg(null);
    setFormSending(false);
    setCreatedCreds(null);
    fetchModalUsers(client.company_id);
  };

  const closeModal = () => {
    setModalClient(null);
    setModalUsers([]);
    fetchClientUserCounts();
  };

  const handleDeleteUser = async (user: ClientUser) => {
    // Try RPC first
    const { error: rpcError } = await supabase.rpc("delete_user_completely", {
      target_user_id: user.user_id,
    });
    if (rpcError) {
      await supabase.from("user_roles").delete().eq("id", user.id);
    }
    const cid = modalClient?.company_id ?? (isClientAdmin ? userRole?.company_id : null);
    if (cid) fetchModalUsers(cid);
  };

  const togglePerm = (key: string) => {
    setFormPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEditPerm = (key: string) => {
    setEditPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startEditing = (u: ClientUser) => {
    setEditingUserId(u.id);
    setEditName((u.permissions.name as string) || "");
    setEditEmail((u.permissions.email as string) || "");
    setEditPassword("");
    setShowEditPassword(false);
    setEditRole(u.role as "client" | "client_admin");
    setEditMsg(null);
    setDeleteConfirmId(null);
    // Build perms from existing
    const perms: Record<string, boolean | string[]> = { ...getDefaultClientPerms() };
    for (const key of Object.keys(perms)) {
      if (key in u.permissions) {
        perms[key] = u.permissions[key] as boolean | string[];
      }
    }
    if (u.permissions.can_manage_users) {
      perms.can_manage_users = true;
    }
    setEditPerms(perms);
  };

  const handleSaveUser = async (u: ClientUser) => {
    setEditSaving(true);
    setEditMsg(null);
    try {
      const updatedPerms: Record<string, unknown> = {
        ...editPerms,
        name: editName,
        email: editEmail,
      };
      // client_admin gets can_view_settings and can_manage_users
      if (editRole === "client_admin") {
        updatedPerms.can_view_settings = true;
      }

      const { error: roleError } = await supabase
        .from("user_roles")
        .update({
          role: editRole,
          permissions: updatedPerms,
        })
        .eq("id", u.id);

      if (roleError) throw roleError;

      setEditMsg({ type: "success", text: "User updated successfully!" });
      const cid = modalClient?.company_id ?? (isClientAdmin ? userRole?.company_id : null);
    if (cid) fetchModalUsers(cid);
      // Close edit after short delay
      setTimeout(() => {
        setEditingUserId(null);
        setEditMsg(null);
      }, 1200);
    } catch (err) {
      setEditMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to update user" });
    }
    setEditSaving(false);
  };

  const handleCreateUser = async () => {
    const companyId = modalClient?.company_id ?? (isClientAdmin ? userRole?.company_id : null);
    if (!companyId || !formEmail || !formPassword) return;
    setFormSending(true);
    setFormMsg(null);
    setCreatedCreds(null);

    // Sanity check: the company_id MUST exist in clients, otherwise the new
    // user will log in and see zero data.
    const { data: clientCheck } = await supabase
      .from("clients")
      .select("company_id, company_name")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!clientCheck) {
      console.error("[Settings] Attempted to create user with invalid company_id:", companyId);
      setFormMsg({ type: "error", text: `No client found with company_id "${companyId}". Create the client first.` });
      setFormSending(false);
      return;
    }
    console.log("[Settings] Creating client user for:", clientCheck.company_name, `(${companyId})`);

    const permissionsJson: Record<string, unknown> = {
      ...formPerms,
      name: formName,
      email: formEmail,
    };

    try {
      let newUserId: string | undefined;

      // Try admin API first
      try {
        const adminRes = await (supabase.auth.admin as { createUser: (opts: Record<string, unknown>) => Promise<{ data: { user?: { id: string } | null }; error: { message: string } | null }> }).createUser({
          email: formEmail,
          password: formPassword,
          email_confirm: true,
          user_metadata: { name: formName },
        });
        if (adminRes.error) throw new Error(adminRes.error.message);
        newUserId = adminRes.data.user?.id;
      } catch {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formEmail,
          password: formPassword,
          options: { data: { name: formName } },
        });
        if (signUpError) {
          setFormMsg({ type: "error", text: signUpError.message });
          setFormSending(false);
          return;
        }
        newUserId = signUpData.user?.id;
      }

      if (!newUserId) {
        setFormMsg({ type: "error", text: "Failed to create user account." });
        setFormSending(false);
        return;
      }

      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: newUserId,
        role: formRole,
        company_id: companyId,
        permissions: permissionsJson,
      });

      if (roleError) {
        setFormMsg({ type: "error", text: roleError.message });
      } else {
        setCreatedCreds({ email: formEmail, password: formPassword });
        setFormMsg({ type: "success", text: "User created successfully!" });
        fetchModalUsers(companyId);
        // Reset form for next user
        setFormName("");
        setFormEmail("");
        setFormPassword("");
        setShowPassword(false);
      }
    } catch (err) {
      setFormMsg({ type: "error", text: err instanceof Error ? err.message : "An error occurred" });
    }
    setFormSending(false);
  };

  if (loading && !isClientAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // --- Client Admin: simplified User Management view ---
  if (isClientAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="p-6 max-w-2xl"
      >
        <h1 className="text-xl font-bold text-primary mb-1">User Management</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Manage users on your account.
        </p>

        {/* Existing users */}
        <div className="glass-card p-5 mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Current Users
          </h2>
          {modalUsersLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : modalUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No users yet.</p>
          ) : (
            <div className="space-y-2">
              {modalUsers.map((u) => {
                const isEditing = editingUserId === u.id;
                return (
                  <div key={u.id} className="rounded-md border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => isEditing ? setEditingUserId(null) : startEditing(u)}
                      className="flex items-center justify-between px-3 py-2 w-full text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isEditing ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="shrink-0 text-muted-foreground" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {(u.permissions.name as string) || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {(u.permissions.email as string) || u.user_id.slice(0, 8) + "..."}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary mx-2 shrink-0">
                        {u.role === "client_admin" ? "Admin" : "User"}
                      </span>
                    </button>
                    {isEditing && (
                      <div className="px-4 pb-4 pt-2 border-t border-border space-y-3 bg-muted/5">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Full Name</label>
                          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Email</label>
                          <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Role</label>
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value as "client" | "client_admin")} className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                            <option value="client">Client User</option>
                            <option value="client_admin">Client Admin</option>
                          </select>
                        </div>
                        {editMsg && (
                          <div className={`rounded-md px-3 py-2 text-sm ${editMsg.type === "success" ? "bg-success/10 border border-success/30 text-success" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>
                            {editMsg.text}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleSaveUser(u)}
                            disabled={editSaving}
                            className="flex-1 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {editSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Changes</>}
                          </button>
                          {deleteConfirmId === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-destructive">Delete?</span>
                              <button onClick={() => { handleDeleteUser(u); setDeleteConfirmId(null); setEditingUserId(null); }} className="px-2.5 py-1.5 rounded-md bg-destructive text-white text-xs font-medium hover:opacity-90 transition-opacity">Confirm</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="px-2.5 py-1.5 rounded-md border border-border text-muted-foreground text-xs hover:text-foreground transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(u.id)} className="px-3 py-2 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium flex items-center gap-1.5">
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add User section (only if canManageUsers) */}
        {canManageUsers && (
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Add User
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Full Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="user@company.com" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type={showPassword ? "text" : "password"} value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Enter password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button type="button" onClick={() => { setFormPassword(generatePassword()); setShowPassword(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs whitespace-nowrap">
                    <RefreshCw size={14} /> Generate
                  </button>
                </div>
                {formPassword && (
                  <div className="mt-2 space-y-1">
                    {PASSWORD_RULES.map((rule) => {
                      const met = validatePassword(formPassword)[rule.key];
                      return (
                        <div key={rule.key} className="flex items-center gap-1.5">
                          <Check size={12} className={met ? "text-blue-400" : "text-muted-foreground/40"} />
                          <span className={`text-xs ${met ? "text-blue-400" : "text-muted-foreground/60"}`}>{rule.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Role</label>
                <select value={formRole} onChange={(e) => setFormRole(e.target.value as "client" | "client_admin")} className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="client">Client User</option>
                  <option value="client_admin">Client Admin</option>
                </select>
              </div>
              {formMsg && (
                <div className={`rounded-md px-3 py-2 text-sm ${formMsg.type === "success" ? "bg-success/10 border border-success/30 text-success" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>
                  <div className="flex items-center gap-2">
                    {formMsg.type === "success" && <Check size={14} />}
                    {formMsg.text}
                  </div>
                  {createdCreds && (
                    <div className="mt-2 p-2 rounded bg-card border border-border text-foreground text-xs font-mono space-y-1">
                      <div><span className="text-muted-foreground">Email:</span> {createdCreds.email}</div>
                      <div><span className="text-muted-foreground">Password:</span> {createdCreds.password}</div>
                      <p className="text-muted-foreground text-[10px] mt-1">Copy these credentials and share them with the user.</p>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={handleCreateUser}
                disabled={formSending || !formEmail || !formPassword || !isPasswordValid(formPassword)}
                className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formSending ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><UserPlus size={16} /> Create User</>}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="p-3 sm:p-6"
    >
      <h1 className="text-lg sm:text-xl font-bold text-primary mb-1">Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage clients, employees, and dashboard access.
      </p>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex items-center gap-6 border-b border-border mb-6">
          <button
            onClick={() => setTab("clients")}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              tab === "clients" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Client Management
            {tab === "clients" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setTab("employees")}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              tab === "employees" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Employee Management
            {tab === "employees" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setTab("agent_dates")}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              tab === "agent_dates" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Agent Start Dates
            {tab === "agent_dates" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      )}

      {/* Tab Content */}
      {tab === "clients" ? (
        <>
          {/* Show/hide internal test accounts */}
          <label className="flex items-center gap-2 mb-3 text-sm text-muted-foreground cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={showTestClients}
              onChange={(e) => setShowTestClients(e.target.checked)}
              className="accent-primary"
            />
            Show test accounts
          </label>

          {/* Existing Clients */}
          <div className="glass-card overflow-x-auto mb-6">
            <div className="grid gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30 min-w-[1000px]" style={{ gridTemplateColumns: "120px minmax(200px, 2fr) 70px 90px 120px 1fr 1fr 100px 40px" }}>
              <div>Company ID</div>
              <div>Company Name</div>
              <div>Seats</div>
              <div>Status</div>
              <div>Launch Date</div>
              <div>Email</div>
              <div>Phone</div>
              <div className="text-center">Access</div>
              <div></div>
            </div>
            {(showTestClients ? clients : clients.filter((c) => !isTestClient(c))).map((client) => {
              const userCount = clientUserCounts[client.company_id] || 0;
              return (
                <div key={client.id} className="grid gap-2 px-4 py-3 items-center border-b border-border min-w-[1000px]" style={{ gridTemplateColumns: "120px minmax(200px, 2fr) 70px 90px 120px 1fr 1fr 100px 40px" }}>
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
                  <div className="text-center">
                    <button
                      onClick={() => openModal(client)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                        userCount > 0
                          ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title="Manage client access"
                    >
                      {userCount > 0 ? <Users size={12} /> : <UserPlus size={12} />}
                      {userCount > 0 ? `Manage (${userCount})` : "Create Login"}
                    </button>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => handleDeleteClient(client.id)}
                      className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
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
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-primary disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add Client
              </button>
            </div>
          </div>
        </>
      ) : tab === "employees" ? (
        <EmployeeManagement isAdmin={isAdmin} />
      ) : (
        <AgentStartDates />
      )}

      {/* Manage Client Access Modal */}
      {modalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div
            className="relative w-full max-w-lg mx-0 sm:mx-4 rounded-none sm:rounded-lg border-0 sm:border border-border p-4 sm:p-6 h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto"
            style={{ background: "#111827" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                Manage Client Access — {modalClient.company_name}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Existing users list */}
            <div className="mb-5">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                Existing Users
              </h4>
              {modalUsersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : modalUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No users yet for this client.</p>
              ) : (
                <div className="space-y-2">
                  {modalUsers.map((u) => {
                    const isEditing = editingUserId === u.id;
                    return (
                      <div key={u.id} className="rounded-md border border-border overflow-hidden">
                        {/* User row header — click to expand */}
                        <button
                          type="button"
                          onClick={() => isEditing ? setEditingUserId(null) : startEditing(u)}
                          className="flex items-center justify-between px-3 py-2 w-full text-left hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isEditing ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="shrink-0 text-muted-foreground" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">
                                {(u.permissions.name as string) || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {(u.permissions.email as string) || u.user_id.slice(0, 8) + "..."}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary mx-2 shrink-0">
                            {u.role === "client_admin" ? "Admin" : "User"}
                          </span>
                          {(isAdmin || hasPermission("can_view_client_profiles")) && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                startImpersonation({
                                  user_id: u.user_id,
                                  role: u.role,
                                  company_id: modalClient?.company_id ?? null,
                                  permissions: u.permissions,
                                  name: (u.permissions.name as string) || "Client User",
                                });
                              }}
                              className="p-1 rounded hover:bg-orange-500/20 text-muted-foreground hover:text-orange-400 transition-colors shrink-0 cursor-pointer"
                              title="Login As"
                            >
                              <UserCheck size={14} />
                            </span>
                          )}
                        </button>

                        {/* Expanded edit section */}
                        {isEditing && (
                          <div className="px-4 pb-4 pt-2 border-t border-border space-y-3 bg-muted/5">
                            {/* Name */}
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Full Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </div>

                            {/* Email */}
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Email</label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </div>

                            {/* Password Reset */}
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Reset Password</label>

                              {isAdmin && (
                                <>
                                  <div className="flex gap-2 mt-1">
                                    <div className="relative flex-1">
                                      <input
                                        type={showEditPassword ? "text" : "password"}
                                        value={editPassword}
                                        onChange={(e) => setEditPassword(e.target.value)}
                                        className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="New password"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowEditPassword(!showEditPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        tabIndex={-1}
                                      >
                                        {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => { setEditPassword(generatePassword()); setShowEditPassword(true); }}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs whitespace-nowrap"
                                    >
                                      <RefreshCw size={14} />
                                      Generate
                                    </button>
                                  </div>
                                  {editPassword && (
                                    <div className="mt-2 space-y-1">
                                      {PASSWORD_RULES.map((rule) => {
                                        const met = validatePassword(editPassword)[rule.key];
                                        return (
                                          <div key={rule.key} className="flex items-center gap-1.5">
                                            <Check size={12} className={met ? "text-blue-400" : "text-muted-foreground/40"} />
                                            <span className={`text-xs ${met ? "text-blue-400" : "text-muted-foreground/60"}`}>{rule.label}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}

                              <div className="flex gap-2 mt-2">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!editPassword || !isPasswordValid(editPassword)) return;
                                      setEditSaving(true);
                                      try {
                                        const { error } = await supabase.rpc('admin_set_user_password', {
                                          target_user_id: u.user_id,
                                          new_password: editPassword,
                                        });
                                        if (error) {
                                          setEditMsg({ type: "error", text: `Password update failed: ${error.message}` });
                                        } else {
                                          setEditMsg({ type: "success", text: "Password updated successfully." });
                                          setEditPassword("");
                                        }
                                      } catch {
                                        setEditMsg({ type: "error", text: "Failed to update password." });
                                      }
                                      setEditSaving(false);
                                    }}
                                    disabled={editSaving || !editPassword || !isPasswordValid(editPassword)}
                                    className="flex-1 py-2 rounded-md bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Set Password
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const email = editEmail || (u.permissions?.email as string);
                                    if (!email) {
                                      setEditMsg({ type: "error", text: "No email on file for this user." });
                                      return;
                                    }
                                    setEditSaving(true);
                                    try {
                                      const redirectUrl = window.location.origin + window.location.pathname;
                                      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
                                      if (error) {
                                        setEditMsg({ type: "error", text: error.message });
                                      } else {
                                        setEditMsg({ type: "success", text: `Reset link sent to ${email}.` });
                                      }
                                    } catch {
                                      setEditMsg({ type: "error", text: "Failed to send reset link." });
                                    }
                                    setEditSaving(false);
                                  }}
                                  disabled={editSaving}
                                  className={`flex-1 py-2 rounded-md font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                    isAdmin
                                      ? "border border-border bg-card hover:bg-muted/30 text-foreground"
                                      : "bg-primary hover:bg-primary/90 text-white"
                                  }`}
                                >
                                  {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                  Send Reset Link
                                </button>
                              </div>
                            </div>

                            {/* Role */}
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Role</label>
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as "client" | "client_admin")}
                                className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                              >
                                <option value="client">Client User</option>
                                <option value="client_admin">Client Admin</option>
                              </select>
                            </div>

                            {/* Permission toggles */}
                            <div>
                              <label className="block text-xs text-muted-foreground mb-2 uppercase tracking-wider">Permissions</label>
                              <div className="space-y-1.5">
                                {CLIENT_PERMISSION_LABELS.map((p) => {
                                  const isOn = editPerms[p.key] === true;
                                  return (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() => toggleEditPerm(p.key)}
                                      className="flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-border hover:bg-muted/20 transition-colors"
                                    >
                                      <span className="text-sm text-foreground">{p.label}</span>
                                      <div className={`relative w-9 h-[18px] rounded-full transition-colors ${isOn ? "bg-primary" : "bg-muted"}`}>
                                        <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${isOn ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                                      </div>
                                    </button>
                                  );
                                })}
                                {/* Can manage users — only for client_admin */}
                                {editRole === "client_admin" && (
                                  <button
                                    type="button"
                                    onClick={() => toggleEditPerm("can_manage_users")}
                                    className="flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                                  >
                                    <span className="text-sm text-foreground font-medium">Can manage users</span>
                                    <div className={`relative w-9 h-[18px] rounded-full transition-colors ${editPerms.can_manage_users === true ? "bg-primary" : "bg-muted"}`}>
                                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${editPerms.can_manage_users === true ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                                    </div>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Edit messages */}
                            {editMsg && (
                              <div className={`rounded-md px-3 py-2 text-sm ${
                                editMsg.type === "success"
                                  ? "bg-success/10 border border-success/30 text-success"
                                  : "bg-destructive/10 border border-destructive/30 text-destructive"
                              }`}>
                                {editMsg.text}
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => handleSaveUser(u)}
                                disabled={editSaving}
                                className="flex-1 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {editSaving ? (
                                  <><Loader2 size={14} className="animate-spin" /> Saving...</>
                                ) : (
                                  <><Save size={14} /> Save Changes</>
                                )}
                              </button>
                              {deleteConfirmId === u.id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-destructive">Delete?</span>
                                  <button
                                    onClick={() => { handleDeleteUser(u); setDeleteConfirmId(null); setEditingUserId(null); }}
                                    className="px-2.5 py-1.5 rounded-md bg-destructive text-white text-xs font-medium hover:opacity-90 transition-opacity"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2.5 py-1.5 rounded-md border border-border text-muted-foreground text-xs hover:text-foreground transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(u.id)}
                                  className="px-3 py-2 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium flex items-center gap-1.5"
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add User section */}
            <div className="border-t border-border pt-4">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                Add User
              </h4>
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="John Doe"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="user@company.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormPassword(generatePassword());
                        setShowPassword(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs whitespace-nowrap"
                    >
                      <RefreshCw size={14} />
                      Generate
                    </button>
                  </div>
                  {formPassword && (
                    <div className="mt-2 space-y-1">
                      {PASSWORD_RULES.map((rule) => {
                        const met = validatePassword(formPassword)[rule.key];
                        return (
                          <div key={rule.key} className="flex items-center gap-1.5">
                            <Check size={12} className={met ? "text-blue-400" : "text-muted-foreground/40"} />
                            <span className={`text-xs ${met ? "text-blue-400" : "text-muted-foreground/60"}`}>
                              {rule.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as "client" | "client_admin")}
                    className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="client">Client User</option>
                    <option value="client_admin">Client Admin</option>
                  </select>
                </div>

                {/* Permission toggles */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                    Permissions
                  </label>
                  <div className="space-y-1.5">
                    {CLIENT_PERMISSION_LABELS.map((p) => {
                      const isOn = formPerms[p.key] === true;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePerm(p.key)}
                          className="flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-border hover:bg-muted/20 transition-colors"
                        >
                          <span className="text-sm text-foreground">{p.label}</span>
                          <div
                            className={`relative w-9 h-[18px] rounded-full transition-colors ${
                              isOn ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <div
                              className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
                                isOn ? "translate-x-[18px]" : "translate-x-[2px]"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Messages */}
                {formMsg && (
                  <div className={`rounded-md px-3 py-2 text-sm ${
                    formMsg.type === "success"
                      ? "bg-success/10 border border-success/30 text-success"
                      : "bg-destructive/10 border border-destructive/30 text-destructive"
                  }`}>
                    <div className="flex items-center gap-2">
                      {formMsg.type === "success" && <Check size={14} />}
                      {formMsg.text}
                    </div>
                    {createdCreds && (
                      <div className="mt-2 p-2 rounded bg-card border border-border text-foreground text-xs font-mono space-y-1">
                        <div><span className="text-muted-foreground">Email:</span> {createdCreds.email}</div>
                        <div><span className="text-muted-foreground">Password:</span> {createdCreds.password}</div>
                        <p className="text-muted-foreground text-[10px] mt-1">Copy these credentials and share them with the client.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Create button */}
                <button
                  onClick={handleCreateUser}
                  disabled={formSending || !formEmail || !formPassword || !isPasswordValid(formPassword)}
                  className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {formSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
