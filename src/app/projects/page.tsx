"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea, Field, FormRow } from "@/components/ui/form-field";
import { useStore, formatKsh, ProjectStatus, Priority } from "@/store/app-store";
import { Plus, Repeat, Eye, Trash2, Archive } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { RefreshButton } from "@/components/ui/refresh-button";

type Filter = ProjectStatus | "all";

export default function ProjectsPage() {
  const { projects, staff, clients, addProject, reassignProject, removeProject } = useStore();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const isSeniorArchitect = role === "SENIOR_ARCHITECT";
  const hasFirmWideView = isAdmin || isSeniorArchitect;
  const canCreate = hasFirmWideView;

  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [createError, setCreateError] = useState("");

  // Architects who can be assigned to a project.
  const architects = staff.filter(s => s.role === "ARCHITECT");
  const supervisors = staff;
  const visible = filter === "all" ? projects : projects.filter(p => p.status === filter);

  function projectCount(staffId: string) {
    return projects.filter(p => p.architectId === staffId).length;
  }

  const [form, setForm] = useState({ name: "", clientId: "", location: "", description: "", architectId: "", supervisorId: "", startDate: "", dueDate: "", budget: "", priority: "MEDIUM" as Priority });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    try {
      await addProject({
        name: form.name, clientId: form.clientId, location: form.location,
        description: form.description, architectId: form.architectId || undefined,
        supervisorId: form.supervisorId || undefined, startDate: form.startDate,
        dueDate: form.dueDate, budget: Number(form.budget),
        priority: form.priority,
      });
      setCreateOpen(false);
      setForm({ name: "", clientId: "", location: "", description: "", architectId: "", supervisorId: "", startDate: "", dueDate: "", budget: "", priority: "MEDIUM" });
    } catch (err) {
      setCreateError((err as Error).message || "Failed to create project");
    }
  }

  function handleReassign() {
    if (!reassignTarget || !reassignTo) return;
    reassignProject(reassignTarget, reassignTo, reassignReason);
    setReassignTarget(null); setReassignTo(""); setReassignReason("");
  }

  async function handleArchive(id: string, name: string) {
    if (!confirm(`Archive project "${name}"? It'll be hidden from this list, but its data is kept and can be restored later.`)) return;
    await removeProject(id);
  }

  const filters: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "On track", value: "ON_TRACK" },
    { label: "At risk", value: "AT_RISK" },
    { label: "Delayed", value: "DELAYED" },
    { label: "Completed", value: "COMPLETED" },
  ];

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Projects</h1>
            <p className="text-muted text-[12px] mt-0.5">{projects.length} {hasFirmWideView ? "projects" : "projects assigned to you"} — click a project to view full details</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton />
            {isAdmin && (
              <Link href="/projects/archived" className="flex items-center gap-1.5 border border-line text-muted rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:text-ink hover:border-ink">
                <Archive size={15} />Archived
              </Link>
            )}
            {canCreate && (
              <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90">
                <Plus size={15} />New project
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-[12px] border transition-colors ${filter === f.value ? "bg-ink text-white border-ink" : "bg-surface text-muted border-line hover:border-muted"}`}>
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted font-mono">{visible.length} shown</span>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-vellum">
              <tr className="text-muted text-left">
                <th className="font-medium px-4 py-2.5">Sheet</th>
                <th className="font-medium px-4 py-2.5">Project</th>
                <th className="font-medium px-4 py-2.5">Client</th>
                <th className="font-medium px-4 py-2.5">Architect</th>
                <th className="font-medium px-4 py-2.5">Budget</th>
                <th className="font-medium px-4 py-2.5">Progress</th>
                <th className="font-medium px-4 py-2.5">Status</th>
                <th className="font-medium px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const arch = staff.find(s => s.id === p.architectId);
                const client = clients.find(c => c.id === p.clientId);
                const canManageThis = hasFirmWideView;
                return (
                  <tr key={p.id} className="border-t border-line hover:bg-vellum/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{p.sheetNo}</td>
                    <td className="px-4 py-3">
                      <div className="text-ink font-medium">{p.name}</div>
                      <div className="text-muted text-[11px]">{p.location}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{client?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {arch
                        ? <div className="flex items-center gap-1.5"><Avatar avatarUrl={arch.avatarUrl} initials={arch.initials} name={arch.name} size={20} fontSize={9} /><span className="text-ink">{arch.name}</span></div>
                        : <span className="text-brick text-[11px] font-medium">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">{formatKsh(p.budget)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-line rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: p.status === "ON_TRACK" ? "#2F7A5E" : p.status === "AT_RISK" ? "#B07F1F" : "#B5502E" }} />
                        </div>
                        <span className="font-mono text-[11px] text-muted">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/projects/${p.id}`} className="p-1 text-muted hover:text-blueprint transition-colors" title="View"><Eye size={14} /></Link>
                        {canManageThis && (
                          <button onClick={() => setReassignTarget(p.id)} className="p-1 text-muted hover:text-brick transition-colors" title="Reassign"><Repeat size={14} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleArchive(p.id, p.name)} className="p-1 text-muted hover:text-brick transition-colors" title="Archive"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {visible.length === 0 && <div className="text-center py-10 text-muted text-[12.5px]">No projects match this filter.</div>}
        </Card>

        {/* Create Project Modal */}
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create new project" subtitle="All fields marked * are required" maxWidth="max-w-2xl">
          <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
            <FormRow>
              <Field label="Project name" required><Input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Karen Residence" /></Field>
              <Field label="Client" required>
                <Select required value={form.clientId} onChange={e => setForm(f=>({...f,clientId:e.target.value}))}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </FormRow>
            <Field label="Location" required><Input required value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Karen, Nairobi" /></Field>
            <Field label="Description"><Textarea rows={2} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Brief project description…" /></Field>
            <FormRow>
              <Field label="Assign architect">
                <Select value={form.architectId} onChange={e => setForm(f=>({...f,architectId:e.target.value}))}>
                  <option value="">Select architect</option>
                  {architects.map(a => <option key={a.id} value={a.id}>{a.name} ({roleShort(a.role)})</option>)}
                </Select>
              </Field>
              <Field label="Assign supervisor">
                <Select value={form.supervisorId} onChange={e => setForm(f=>({...f,supervisorId:e.target.value}))}>
                  <option value="">Select supervisor</option>
                  {supervisors.map(a => <option key={a.id} value={a.id}>{a.name} ({roleShort(a.role)})</option>)}
                </Select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Start date" required><Input type="date" required value={form.startDate} onChange={e => setForm(f=>({...f,startDate:e.target.value}))} /></Field>
              <Field label="Due date" required><Input type="date" required value={form.dueDate} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} /></Field>
            </FormRow>
            <FormRow>
              <Field label="Budget (KSh)" required><Input type="number" required value={form.budget} onChange={e => setForm(f=>({...f,budget:e.target.value}))} placeholder="e.g. 18500000" /></Field>
              <Field label="Priority">
                <Select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value as Priority}))}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                </Select>
              </Field>
            </FormRow>
            {createError && <p className="text-brick text-[12px]">{createError}</p>}
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Create project</button>
            </div>
          </form>
        </Modal>

        {/* Reassign Modal */}
        <Modal open={!!reassignTarget} onClose={() => setReassignTarget(null)} title="Reassign project" subtitle="The new architect gets immediate access to all project history">
          {reassignTarget && (() => {
            const p = projects.find(pr => pr.id === reassignTarget)!;
            const current = staff.find(s => s.id === p.architectId);
            return (
              <div className="flex flex-col gap-3.5">
                <div className="bg-vellum rounded-md p-3 text-[12.5px]">
                  <div className="text-muted">Project</div>
                  <div className="text-ink font-medium mt-0.5">{p.sheetNo} — {p.name}</div>
                  <div className="text-muted mt-2">Currently assigned to</div>
                  <div className="text-ink font-medium mt-0.5">{current ? current.name : <span className="text-brick">Unassigned</span>}</div>
                </div>
                <Field label="Reassign to" required>
                  <Select value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                    <option value="">Select architect</option>
                    {architects.filter(a => a.id !== p.architectId).map(a => <option key={a.id} value={a.id}>{a.name} ({projectCount(a.id)} active projects)</option>)}
                  </Select>
                </Field>
                <Field label="Reason for reassignment">
                  <Textarea rows={2} value={reassignReason} onChange={e => setReassignReason(e.target.value)} placeholder="e.g. Architect on leave, workload rebalancing…" />
                </Field>
                <div className="flex justify-end gap-2 pt-1 border-t border-line">
                  <button onClick={() => setReassignTarget(null)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
                  <button onClick={handleReassign} disabled={!reassignTo} className="px-4 py-2 rounded-md text-[12.5px] bg-brick text-white font-medium disabled:opacity-50">Confirm reassignment</button>
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>
    </AppShell>
  );
}

function roleShort(r: string) {
  if (r === "ADMIN") return "Admin";
  if (r === "SENIOR_ARCHITECT") return "Senior Architect";
  return "Architect";
}
