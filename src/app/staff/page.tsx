"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Field, FormRow } from "@/components/ui/form-field";
import { useStore, roleLabel, Role } from "@/store/app-store";
import { Plus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

const roleColors: Record<Role, string> = {
  ADMIN: "bg-blueprint-bg text-blueprint",
  ARCHITECT: "bg-ochre-bg text-ochre",
};

export default function StaffPage() {
  const { staff, projects, addStaff, updateStaff, removeStaff } = useStore();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "ARCHITECT" as Role, department: "", password: "" });
  const [tempPasswordNotice, setTempPasswordNotice] = useState<{ name: string; password: string } | null>(null);

  function resetForm() { setForm({ name: "", email: "", phone: "", role: "ARCHITECT", department: "", password: "" }); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { password, ...rest } = form;
    const result = await addStaff({ ...rest, password: password || undefined });
    setCreateOpen(false);
    if (result.temporaryPassword) setTempPasswordNotice({ name: form.name, password: result.temporaryPassword });
    resetForm();
  }

  function openEdit(id: string) {
    const s = staff.find(m => m.id === id)!;
    setForm({ name: s.name, email: s.email, phone: s.phone ?? "", role: s.role, department: s.department ?? "", password: "" });
    setEditTarget(id);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const initials = form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const { password, ...rest } = form;
    await updateStaff(editTarget, { ...rest, initials, ...(password ? { password } : {}) });
    setEditTarget(null); resetForm();
  }

  async function handleToggleActive(member: (typeof staff)[number]) {
    await updateStaff(member.id, { isActive: !(member.isActive ?? true) });
  }

  async function handleForceReset(member: (typeof staff)[number]) {
    const result = await updateStaff(member.id, { resetPassword: true });
    if (result.temporaryPassword) setTempPasswordNotice({ name: member.name, password: result.temporaryPassword });
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <Card className="p-8 text-center max-w-md mx-auto mt-16">
          <ShieldAlert size={28} className="mx-auto text-brick mb-3" />
          <div className="text-ink font-medium text-[14px] mb-1">Admins only</div>
          <p className="text-muted text-[12.5px]">Staff management is restricted to administrators. Contact your admin if you need a change made.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Staff</h1>
            <p className="text-muted text-[12px] mt-0.5">{staff.length} team members</p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90">
            <Plus size={15} />Add staff member
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {staff.map(member => {
            const memberProjects = projects.filter(p => p.architectId === member.id || p.supervisorId === member.id);
            return (
              <Card key={member.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={member.avatarUrl} initials={member.initials} name={member.name} size={40} fontSize={14} />
                    <div>
                      <div className="font-display font-semibold text-[14px] text-ink">{member.name}</div>
                      <div className="text-muted text-[11.5px]">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleForceReset(member)} title="Force password reset" className="p-1.5 text-muted hover:text-blueprint transition-colors"><ShieldAlert size={14} /></button>
                    <button onClick={() => openEdit(member.id)} className="p-1.5 text-muted hover:text-blueprint transition-colors"><Edit2 size={14} /></button>
                    {member.role !== "ADMIN" && (
                      <button onClick={() => removeStaff(member.id)} className="p-1.5 text-muted hover:text-brick transition-colors"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                  <span className={`text-[10.5px] px-2 py-0.5 rounded-[3px] font-medium ${roleColors[member.role]}`}>{roleLabel(member.role)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(member)}
                      className={`text-[10.5px] px-2 py-0.5 rounded-[3px] font-medium ${member.isActive === false ? "bg-brick-bg text-brick" : "bg-moss-bg text-moss"}`}
                    >
                      {member.isActive === false ? "Deactivated" : "Active"}
                    </button>
                    <span className="text-[11px] text-muted">{member.department}</span>
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div><div className="text-muted text-[11px]">Phone</div><div className="text-ink">{member.phone}</div></div>
                  <div><div className="text-muted text-[11px]">Active projects</div><div className="text-ink font-medium">{memberProjects.length}</div></div>
                </div>
                {memberProjects.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-line">
                    <div className="text-[11px] text-muted mb-1.5">Assigned to</div>
                    <div className="flex flex-wrap gap-1">
                      {memberProjects.slice(0, 3).map(p => (
                        <span key={p.id} className="text-[10.5px] bg-vellum border border-line rounded px-1.5 py-0.5 font-mono">{p.sheetNo}</span>
                      ))}
                      {memberProjects.length > 3 && <span className="text-[10.5px] text-muted">+{memberProjects.length - 3} more</span>}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Create Staff Modal */}
        <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title="Add staff member">
          <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
            <Field label="Full name" required><Input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Amina Wanjiru" /></Field>
            <FormRow>
              <Field label="Email" required><Input type="email" required value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="name@firm.com" /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="+254 7XX XXX XXX" /></Field>
            </FormRow>
            <FormRow>
              <Field label="Role" required>
                <Select required value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value as Role}))}>
                  <option value="ARCHITECT">Architect</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </Field>
              <Field label="Department"><Input value={form.department} onChange={e => setForm(f=>({...f,department:e.target.value}))} placeholder="e.g. Design" /></Field>
            </FormRow>
            <Field label="Initial password (optional)"><Input type="text" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="Leave blank to auto-generate a secure temp password" /></Field>
            <p className="text-[11px] text-muted -mt-2">They must reset this on first login. If left blank, a secure temporary password is generated and shown once after creation — share it with them securely.</p>
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => { setCreateOpen(false); resetForm(); }} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Add member</button>
            </div>
          </form>
        </Modal>

        {/* Edit Staff Modal */}
        <Modal open={!!editTarget} onClose={() => { setEditTarget(null); resetForm(); }} title="Edit staff member">
          <form onSubmit={handleEdit} className="flex flex-col gap-3.5">
            <Field label="Full name" required><Input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></Field>
            <FormRow>
              <Field label="Email" required><Input type="email" required value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} /></Field>
            </FormRow>
            <FormRow>
              <Field label="Role">
                <Select value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value as Role}))}>
                  <option value="ARCHITECT">Architect</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </Field>
              <Field label="Department"><Input value={form.department} onChange={e => setForm(f=>({...f,department:e.target.value}))} /></Field>
            </FormRow>
            <Field label="Set specific password (optional)"><Input type="text" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="Leave blank to keep current password" /></Field>
            <p className="text-[11px] text-muted -mt-2">To generate a fresh temporary password instead, use the shield icon on their card and cancel this dialog.</p>
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => { setEditTarget(null); resetForm(); }} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Save changes</button>
            </div>
          </form>
        </Modal>

        {/* Temporary password notice */}
        <Modal open={!!tempPasswordNotice} onClose={() => setTempPasswordNotice(null)} title="Temporary password generated">
          <div className="flex flex-col gap-3">
            <p className="text-muted text-[12.5px]">
              A temporary password was generated for <span className="text-ink font-medium">{tempPasswordNotice?.name}</span>. It will only be shown once here — copy it and share it securely. They will be required to change it on first login.
            </p>
            <div className="bg-vellum border border-line rounded-md px-3 py-2.5 font-mono text-[14px] text-ink select-all">
              {tempPasswordNotice?.password}
            </div>
            <button
              type="button"
              onClick={() => setTempPasswordNotice(null)}
              className="self-end px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium"
            >
              Done
            </button>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
