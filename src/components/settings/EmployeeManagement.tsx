import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { UserPermissions } from "@/lib/auth";
import { startImpersonation } from "@/lib/auth";
import { Plus, Pencil, Trash2, X, Loader2, Check, Eye, EyeOff, RefreshCw, Mail, KeyRound, AlertTriangle, UserCheck } from "lucide-react";

interface Employee {
  id: string;
  user_id: string;
  role: string;
  permissions: UserPermissions & { email?: string };
  email?: string;
}

const PERMISSION_LABELS: { key: keyof UserPermissions; label: string; defaultOn: boolean; warning?: string }[] = [
  { key: "can_view_overview", label: "Can view Overview", defaultOn: true },
  { key: "can_view_performance", label: "Can view Performance", defaultOn: true },
  { key: "can_view_leaderboard", label: "Can view Leaderboard", defaultOn: true },
  { key: "can_view_historical", label: "Can view Historical", defaultOn: true },
  { key: "can_view_settings", label: "Can view Settings", defaultOn: false, warning: "\u26a0\ufe0f Warning: Settings access allows managing client accounts and employee data." },
  { key: "can_view_contacts", label: "Can view contact info", defaultOn: true },
  { key: "can_view_recordings", label: "Can view recordings", defaultOn: true },
  { key: "can_view_credit_scores", label: "Can view credit scores", defaultOn: false },
  { key: "can_view_commissions", label: "Can view commissions", defaultOn: false },
  { key: "can_view_all_clients", label: "Can view all clients", defaultOn: true },
  { key: "can_view_leads", label: "Can view Leads", defaultOn: true },
  { key: "can_view_client_profiles", label: "Can view client profiles", defaultOn: false, warning: "\u26a0\ufe0f Warning: This permission allows the employee to view any client's dashboard as if they were logged in as that client. Only grant this to trusted employees." },
];

function getDefaultPermissions(): UserPermissions {
  return {
    can_view_overview: true,
    can_view_performance: true,
    can_view_leaderboard: true,
    can_view_historical: true,
    can_view_settings: false,
    can_view_contacts: true,
    can_view_recordings: true,
    can_view_credit_scores: false,
    can_view_commissions: false,
    can_view_all_clients: true,
    can_view_leads: true,
    can_view_client_profiles: false,
    restricted_client_ids: [],
  };
}

function summarizePermissions(perms: UserPermissions): string {
  const on = PERMISSION_LABELS.filter((p) => perms[p.key] === true).length;
  return `${on}/${PERMISSION_LABELS.length} enabled`;
}

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

function PasswordValidationChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const met = validatePassword(password)[rule.key];
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
  );
}

function PasswordField({
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        placeholder={placeholder ?? "Enter password"}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function EmployeeManagement({ isAdmin = false }: { isAdmin?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<"backend_employee" | "frontend_employee">("backend_employee");
  const [formPerms, setFormPerms] = useState<UserPermissions>(getDefaultPermissions());
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  // Edit modal - password reset
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Remove confirmation
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeSending, setRemoveSending] = useState(false);
  const [removeWarning, setRemoveWarning] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("id, user_id, role, permissions")
        .in("role", ["backend_employee", "frontend_employee"])
        .order("created_at", { ascending: true });

      if (data) {
        setEmployees(
          data.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            role: d.role,
            permissions: { ...getDefaultPermissions(), ...(d.permissions as Partial<UserPermissions & { email?: string }>) },
          }))
        );
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const openInviteModal = () => {
    setEditingEmployee(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setShowPassword(false);
    setFormRole("backend_employee");
    setFormPerms(getDefaultPermissions());
    setSuccessMsg(null);
    setErrorMsg(null);
    setCreatedCredentials(null);
    setResetPassword("");
    setShowResetPassword(false);
    setResetMsg(null);
    setShowRemoveConfirm(false);
    setRemoveWarning(null);
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.permissions.name ?? "");
    setFormEmail(emp.permissions.email ?? "");
    setFormRole(emp.role as "backend_employee" | "frontend_employee");
    setFormPerms({ ...emp.permissions });
    setSuccessMsg(null);
    setErrorMsg(null);
    setCreatedCredentials(null);
    setResetPassword("");
    setShowResetPassword(false);
    setResetMsg(null);
    setShowRemoveConfirm(false);
    setRemoveWarning(null);
    setShowModal(true);
  };

  const handleDelete = async (emp: Employee) => {
    await supabase.from("user_roles").delete().eq("id", emp.id);
    fetchEmployees();
  };

  const togglePerm = (key: keyof UserPermissions) => {
    setFormPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSetPassword = async () => {
    if (!editingEmployee || !resetPassword) return;
    setResetSending(true);
    setResetMsg(null);
    try {
      const { error } = await supabase.rpc('admin_set_user_password', {
        target_user_id: editingEmployee.user_id,
        new_password: resetPassword,
      });
      if (error) {
        setResetMsg(`Error: ${error.message}`);
      } else {
        setResetMsg("Password updated successfully.");
        setResetPassword("");
      }
    } catch (err) {
      setResetMsg(`Error: ${err instanceof Error ? err.message : "Failed to update password"}`);
    }
    setResetSending(false);
  };

  const handleSendResetLink = async () => {
    const email = formEmail || editingEmployee?.permissions.email;
    if (!email) {
      setResetMsg("No email on file for this employee.");
      return;
    }
    setResetSending(true);
    setResetMsg(null);
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) {
        setResetMsg(`Error: ${error.message}`);
      } else {
        setResetMsg(`Password reset link sent to ${email}.`);
      }
    } catch {
      setResetMsg("Error: Failed to send reset link.");
    }
    setResetSending(false);
  };

  const handleRemoveEmployee = async () => {
    if (!editingEmployee) return;
    setRemoveSending(true);
    setRemoveWarning(null);

    try {
      // Try RPC that deletes from both user_roles and auth.users
      const { error: rpcError } = await supabase.rpc("delete_user_completely", {
        target_user_id: editingEmployee.user_id,
      });

      if (rpcError) {
        // RPC doesn't exist or failed — fallback to user_roles only
        console.warn("[EmployeeManagement] RPC delete_user_completely failed:", rpcError.message);
        await supabase.from("user_roles").delete().eq("id", editingEmployee.id);
        setRemoveWarning("Role removed, but the auth account may need manual cleanup in Supabase dashboard.");
      }

      if (!removeWarning) {
        setShowModal(false);
      }
      fetchEmployees();
    } catch {
      setErrorMsg("Failed to remove employee.");
    }
    setRemoveSending(false);
  };

  const handleSubmit = async () => {
    setSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const permissionsJson: Record<string, unknown> = { ...formPerms, name: formName, email: formEmail };

    try {
      if (editingEmployee) {
        // Update user_roles
        const { error } = await supabase
          .from("user_roles")
          .update({
            role: formRole,
            permissions: permissionsJson,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingEmployee.id);

        if (error) {
          setErrorMsg(error.message);
          setSending(false);
          return;
        }

        // If email changed, update in auth.users
        const oldEmail = editingEmployee.permissions.email;
        if (formEmail && formEmail !== oldEmail) {
          try {
            const adminRes = await (supabase.auth.admin as { updateUserById: (id: string, opts: Record<string, unknown>) => Promise<{ error: { message: string } | null }> }).updateUserById(
              editingEmployee.user_id,
              { email: formEmail }
            );
            if (adminRes.error) throw new Error(adminRes.error.message);
          } catch {
            // Admin API unavailable — email updated in permissions only
          }
        }

        setSuccessMsg("Employee updated successfully.");
        fetchEmployees();
        setTimeout(() => setShowModal(false), 1200);
      } else {
        // Create new user
        if (!formEmail) {
          setErrorMsg("Email is required.");
          setSending(false);
          return;
        }
        if (!formPassword) {
          setErrorMsg("Password is required.");
          setSending(false);
          return;
        }

        let newUserId: string | undefined;

        // Try admin API first (requires service_role key)
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
          // Fallback: use signUp (client-side)
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: formEmail,
            password: formPassword,
            options: {
              data: { name: formName },
            },
          });

          if (signUpError) {
            setErrorMsg(signUpError.message);
            setSending(false);
            return;
          }
          newUserId = signUpData.user?.id;
        }

        if (!newUserId) {
          setErrorMsg("Failed to create user account.");
          setSending(false);
          return;
        }

        // Insert role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: newUserId,
          role: formRole,
          permissions: permissionsJson,
        });

        if (roleError) {
          setErrorMsg(roleError.message);
        } else {
          setCreatedCredentials({ email: formEmail, password: formPassword });
          setSuccessMsg(`Employee created successfully!`);
          fetchEmployees();
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred");
    }
    setSending(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Employee Management
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Invite and manage employee access to the dashboard.
          </p>
        </div>
        <button
          onClick={openInviteModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Add Employee
        </button>
      </div>

      {/* Employee Table */}
      <div className="glass-card overflow-x-auto">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30">
          <div>Name</div>
          <div className="hidden sm:block">Email / User ID</div>
          <div className="hidden sm:block">Role</div>
          <div className="hidden sm:block">Permissions</div>
          <div className="text-right">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No employees yet. Click "Add Employee" to create one.
          </div>
        ) : (
          employees.map((emp) => (
            <div
              key={emp.id}
              className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 py-3 items-center border-b border-border"
            >
              <div className="text-sm font-medium text-foreground truncate">
                {emp.permissions.name || "\u2014"}
              </div>
              <div className="hidden sm:block text-sm text-muted-foreground truncate" title={emp.permissions.email ?? emp.user_id}>
                {emp.permissions.email || <span className="italic text-muted-foreground/60">Email not set</span>}
              </div>
              <div className="hidden sm:block">
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {emp.role === "backend_employee" ? "Backend" : "Frontend"}
                </span>
              </div>
              <div className="hidden sm:block text-xs text-muted-foreground">
                {summarizePermissions(emp.permissions)}
              </div>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => startImpersonation({
                    user_id: emp.user_id,
                    role: emp.role,
                    company_id: null,
                    permissions: emp.permissions as unknown as Record<string, unknown>,
                    name: emp.permissions.name || emp.permissions.email || "Employee",
                  })}
                  className="p-1.5 rounded hover:bg-orange-500/20 text-muted-foreground hover:text-orange-400 transition-colors"
                  title="Login As"
                >
                  <UserCheck size={14} />
                </button>
                <button
                  onClick={() => openEditModal(emp)}
                  className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(emp)}
                  className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />

          {/* Modal content */}
          <div className="relative w-full max-w-lg mx-0 sm:mx-4 rounded-none sm:rounded-lg border-0 sm:border border-border p-4 sm:p-6 h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto"
            style={{ background: "#111827" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                {editingEmployee ? "Edit Employee" : "Create Employee"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. Full Name */}
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

              {/* 2. Email (editable for both create and edit) */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="employee@company.com"
                />
              </div>

              {/* 3. Password section */}
              {editingEmployee ? (
                /* Edit mode: password reset */
                <div className="rounded-md border border-border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-muted-foreground" />
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Reset Password
                    </label>
                  </div>

                  {isAdmin && (
                    <>
                      <div className="flex gap-2">
                        <PasswordField
                          value={resetPassword}
                          onChange={setResetPassword}
                          show={showResetPassword}
                          onToggleShow={() => setShowResetPassword(!showResetPassword)}
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setResetPassword(generatePassword());
                            setShowResetPassword(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs whitespace-nowrap"
                          title="Generate Password"
                        >
                          <RefreshCw size={14} />
                          Generate
                        </button>
                      </div>

                      <PasswordValidationChecklist password={resetPassword} />
                    </>
                  )}

                  <div className="flex gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleSetPassword}
                        disabled={resetSending || !resetPassword || !isPasswordValid(resetPassword)}
                        className="flex-1 py-2 rounded-md bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {resetSending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                        Set Password
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSendResetLink}
                      disabled={resetSending || !formEmail}
                      className={`flex-1 py-2 rounded-md font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        isAdmin
                          ? "border border-border bg-card hover:bg-muted/30 text-foreground"
                          : "bg-primary hover:bg-primary/90 text-white"
                      }`}
                    >
                      {resetSending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      Send Reset Link
                    </button>
                  </div>

                  {resetMsg && (
                    <div className={`rounded-md px-3 py-2 text-xs ${
                      resetMsg.startsWith("Error")
                        ? "bg-destructive/10 border border-destructive/30 text-destructive"
                        : "bg-success/10 border border-success/30 text-success"
                    }`}>
                      {resetMsg}
                    </div>
                  )}
                </div>
              ) : (
                /* Create mode: set initial password */
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="flex gap-2">
                    <PasswordField
                      value={formPassword}
                      onChange={setFormPassword}
                      show={showPassword}
                      onToggleShow={() => setShowPassword(!showPassword)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormPassword(generatePassword());
                        setShowPassword(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-xs whitespace-nowrap"
                      title="Generate Password"
                    >
                      <RefreshCw size={14} />
                      Generate
                    </button>
                  </div>
                  <PasswordValidationChecklist password={formPassword} />
                </div>
              )}

              {/* 4. Role */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                  Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as typeof formRole)}
                  className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="backend_employee">Backend Employee</option>
                  <option value="frontend_employee">Frontend Employee</option>
                </select>
              </div>

              {/* 5. Permission toggles */}
              <div>
                <label className="block text-xs text-muted-foreground mb-3 uppercase tracking-wider">
                  Permissions
                </label>
                <div className="space-y-2">
                  {PERMISSION_LABELS.map((p) => {
                    const isOn = formPerms[p.key] === true;
                    return (
                      <div key={p.key}>
                        <button
                          type="button"
                          onClick={() => togglePerm(p.key)}
                          className="flex items-center justify-between w-full px-3 py-2 rounded-md border border-border hover:bg-muted/20 transition-colors"
                        >
                          <span className="text-sm text-foreground">{p.label}</span>
                          <div
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              isOn ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                isOn ? "translate-x-5" : "translate-x-0.5"
                              }`}
                            />
                          </div>
                        </button>
                        {isOn && p.warning && (
                          <div className="mx-1 mt-1 px-3 py-2 rounded-md bg-orange-500/10 border border-orange-500/30 text-xs text-orange-400">
                            {p.warning}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Messages */}
              {errorMsg && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="rounded-md bg-success/10 border border-success/30 px-3 py-2 text-sm text-success">
                  <div className="flex items-center gap-2 mb-1">
                    <Check size={14} />
                    {successMsg}
                  </div>
                  {createdCredentials && (
                    <div className="mt-2 p-2 rounded bg-card border border-border text-foreground text-xs font-mono space-y-1">
                      <div><span className="text-muted-foreground">Email:</span> {createdCredentials.email}</div>
                      <div><span className="text-muted-foreground">Password:</span> {createdCredentials.password}</div>
                      <p className="text-muted-foreground text-[10px] mt-1">Copy these credentials and share them with the employee.</p>
                    </div>
                  )}
                </div>
              )}

              {/* 6. Save Changes / Create Employee button */}
              <button
                onClick={handleSubmit}
                disabled={sending || (!editingEmployee && (!formEmail || !formPassword || !isPasswordValid(formPassword))) || !!createdCredentials}
                className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {editingEmployee ? "Saving..." : "Creating..."}
                  </>
                ) : editingEmployee ? (
                  "Save Changes"
                ) : (
                  "Create Employee"
                )}
              </button>

              {/* 7. Remove Employee (edit only, at bottom) */}
              {editingEmployee && (
                <div className="border-t border-border pt-4 mt-2">
                  {removeWarning && (
                    <div className="rounded-md bg-orange-500/10 border border-orange-500/30 px-3 py-2 text-xs text-orange-400 mb-3 flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      {removeWarning}
                    </div>
                  )}
                  {!showRemoveConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowRemoveConfirm(true)}
                      className="w-full py-2.5 rounded-md border border-destructive/40 bg-destructive/10 text-destructive font-medium text-sm transition-all hover:bg-destructive/20 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      Remove Employee
                    </button>
                  ) : (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-destructive">Are you sure?</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            This will remove {formName || "this employee"} from the dashboard and delete their account. This action cannot be undone.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleRemoveEmployee}
                          disabled={removeSending}
                          className="flex-1 py-2 rounded-md bg-destructive text-white font-medium text-sm transition-all hover:bg-destructive/90 disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {removeSending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Yes, Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRemoveConfirm(false)}
                          className="flex-1 py-2 rounded-md border border-border bg-card text-foreground font-medium text-sm transition-all hover:bg-muted/30"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
