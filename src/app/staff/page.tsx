"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import {
  Field, Input, Select, Button, ErrorBanner, SuccessBanner,
  Spinner, EmptyState, Avatar,
} from "@/components/ui/form";
import { users as usersApi, User, UserRole, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { Plus, ShieldCheck, User as UserIcon, CheckCircle2, XCircle } from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  ARCHITECT: "Architect",
};

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-brick-bg text-brick",
  SUPERVISOR: "bg-blueprint-bg text-blueprint",
  ARCHITECT: "bg-moss-bg text-moss",
};

function StaffContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useRequireAuth();

  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<UserRole | "ALL">("ALL");

  const load = useCallback(() => {
    setLoading(true);
    usersApi.list()
      .then(setStaff)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "ADMIN") { router.replace("/dashboard"); return; }
    load();
  }, [user, load, router]);

  useEffect(() => {
    if (params.get("new") === "1") setCreateOpen(true);
  }, [params]);

  if (authLoading) return <AppShell><Spinner /></AppShell>;

  const visible = filter === "ALL" ? staff : staff.filter((s) => s.role === filter);
  const active = staff.filter((s) => s.isActive).length;

  return (
    <AppShell>
      <Topbar
        title="Staff"
        subtitle={`${active} active team members`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(["ADMIN", "SUPERVISOR", "ARCHITECT"] as UserRole[]).map((role) => {
          const count = staff.filter((s) => s.role === role && s.isActive).length;
          return (
            <Card key={role} className="p-3.5">
              <div className="text-muted text-[11px]">{ROLE_LABELS[role]}s</div>
              <div className="font-display font-bold text-[24px] text-ink mt-0.5">{count}</div>
            </Card>
          );
        })}
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {/* Filter + Add */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          {(["ALL", "ADMIN", "SUPERVISOR", "ARCHITECT"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-1.5 rounded-md text-[12px] border transition-colors ${
                filter === r ? "bg-ink text-white border-ink" : "bg-surface text-muted border-line hover:border-ink/40"
              }`}
            >
              {r === "ALL" ? "All" : ROLE_LABELS[r] + "s"}
            </button>
          ))}
        </div>
        <Button onClick={() => { setCreateOpen(true); }}>
          <Plus size={14} /> Add staff member
        </Button>
      </div>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <Card>
          <EmptyState
            title="No staff yet"
            body="Add your first team member to start assigning them to projects."
            action={<Button onClick={() => setCreateOpen(true)}><Plus size={14} />Add first member</Button>}
          />
        </Card>
      ) : (
        <Card>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Status</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} className="border-t border-line hover:bg-vellum">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${s.firstName} ${s.lastName}`} size="sm" />
                      <div>
                        <div className="font-medium text-ink">
                          {s.firstName} {s.lastName}
                        </div>
                        {s.phone && (
                          <div className="text-[11px] text-muted">{s.phone}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[s.role]}`}>
                      {s.role === "ADMIN" && <ShieldCheck size={10} />}
                      {s.role === "SUPERVISOR" && <UserIcon size={10} />}
                      {ROLE_LABELS[s.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{s.email}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {s.isActive ? (
                      <span className="flex items-center gap-1 text-moss text-[11px]">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-brick text-[11px]">
                        <XCircle size={12} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-[11px] hidden md:table-cell">
                    {s.lastLoginAt
                      ? new Date(s.lastLoginAt).toLocaleDateString("en-KE")
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditUser(s)}
                      className="text-[11.5px] text-blueprint hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {createOpen && (
        <CreateStaffModal
          onClose={() => { setCreateOpen(false); router.replace("/staff"); }}
          onCreated={() => { setCreateOpen(false); router.replace("/staff"); load(); }}
        />
      )}
      {editUser && (
        <EditStaffModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); load(); }}
        />
      )}
    </AppShell>
  );
}

export default function StaffPage() {
  return (
    <Suspense>
      <StaffContent />
    </Suspense>
  );
}

// ─── Create staff modal ───────────────────────────────────────────────────────

function CreateStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("ARCHITECT");
  const [tempPassword, setTempPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!firstName || !lastName || !email || !tempPassword) {
      setError("First name, last name, email, and a temporary password are required.");
      return;
    }
    if (tempPassword.length < 12) {
      setError("Temporary password must be at least 12 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersApi.create({ firstName, lastName, email, phone: phone || undefined, role, temporaryPassword: tempPassword });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add staff member" subtitle="They will receive their login credentials and can change the password after first login.">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="First name" required>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Naomi" />
        </Field>
        <Field label="Last name" required>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Otieno" />
        </Field>
        <Field label="Work email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naomi@yourfirm.com" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7xx xxx xxx" />
        </Field>
        <Field label="Role" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="ARCHITECT">Architect</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
        <Field label="Temporary password" required>
          <Input
            type="text"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Min. 12 characters"
          />
        </Field>
      </div>
      <p className="text-[11.5px] text-muted mb-4">
        Share these credentials securely with the new team member. They must change
        the password after their first login.
      </p>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? "Creating…" : "Create account"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Edit staff modal ─────────────────────────────────────────────────────────

function EditStaffModal({
  user: staff,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(staff.firstName);
  const [lastName, setLastName] = useState(staff.lastName);
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [role, setRole] = useState<UserRole>(staff.role);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(false);
    try {
      await usersApi.update(staff.id, { firstName, lastName, phone: phone || undefined, role });
      setSuccess(true);
      setTimeout(onSaved, 800);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update.");
    } finally { setSaving(false); }
  }

  async function handleDeactivate() {
    if (!confirm(`Deactivate ${staff.firstName} ${staff.lastName}? They will be signed out immediately.`)) return;
    setDeactivating(true);
    try {
      await usersApi.deactivate(staff.id);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not deactivate.");
    } finally { setDeactivating(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Edit — ${staff.firstName} ${staff.lastName}`}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="ARCHITECT">Architect</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
      </div>
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
      {success && <div className="mb-3"><SuccessBanner message="Changes saved." /></div>}
      <div className="flex justify-between items-center">
        {staff.isActive ? (
          <Button variant="ghost" size="sm" onClick={handleDeactivate} disabled={deactivating}>
            <XCircle size={13} /> {deactivating ? "Deactivating…" : "Deactivate account"}
          </Button>
        ) : (
          <span className="text-[12px] text-muted">Account is inactive</span>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </Modal>
  );
}
