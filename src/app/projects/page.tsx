"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { DimensionBar } from "@/components/ui/dimension-bar";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea, Button, ErrorBanner, Spinner, EmptyState } from "@/components/ui/form";
import { projects as projectsApi, users as usersApi, Project, User, formatKsh, healthToStatus, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { Plus, Repeat, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Planning", value: "PLANNING" },
  { label: "Active", value: "ACTIVE" },
  { label: "At risk", value: "AT_RISK" },
  { label: "Delayed", value: "DELAYED" },
  { label: "Completed", value: "COMPLETED" },
];

function ProjectsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useRequireAuth();

  const [items, setItems] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [staff, setStaff] = useState<User[]>([]);

  const load = useCallback(() => {
    setListLoading(true);
    projectsApi
      .list({ status: filter || undefined, search: search || undefined, page })
      .then((r) => { setItems(r.data); setTotal(r.meta.totalCount); })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  }, [filter, search, page]);

  useEffect(() => {
    if (!user) return;
    load();
    usersApi.list().then(setStaff).catch(() => {});
  }, [user, load]);

  useEffect(() => {
    if (params.get("new") === "1") setCreateOpen(true);
  }, [params]);

  if (authLoading) return <AppShell><Spinner /></AppShell>;

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const canManage = user?.role === "ADMIN" || user?.role === "SUPERVISOR";

  return (
    <AppShell>
      <Topbar title="Projects" subtitle={`${total} projects across the firm`} />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-[12px] border transition-colors ${
                filter === f.value
                  ? "bg-ink text-white border-ink"
                  : "bg-surface text-muted border-line hover:border-ink/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or client…"
            className="border border-line rounded-md px-3 py-1.5 text-[12px] w-48 focus:outline-none focus:ring-2 focus:ring-blueprint/40"
          />
          {canManage && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/80"
            >
              <Plus size={15} />
              New project
            </button>
          )}
        </div>
      </div>

      {listLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No projects found"
            body={search || filter ? "Try adjusting your filters." : "Create the first project to get started."}
            action={canManage ? <Button onClick={() => setCreateOpen(true)}><Plus size={14} />New project</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((p) => {
            const status = healthToStatus(p.health);
            const architect = p.assignments[0]?.user;
            return (
              <Card
                key={p.id}
                className="p-4 border-t-[3px] hover:shadow-md transition-shadow cursor-pointer"
                style={{
                  borderTopColor:
                    status === "on_track" ? "#2F7A5E" : status === "at_risk" ? "#B07F1F" : "#B5502E",
                }}
                onClick={() => router.push(`/projects/${p.id}`)}
              >
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="font-mono text-[11px] text-muted">{p.projectNumber}</div>
                    <div className="font-display font-semibold text-[15px] text-ink mt-0.5">{p.name}</div>
                  </div>
                  <StatusPill status={status} />
                </div>
                <div className="text-[11.5px] text-muted mt-1">
                  {p.clientName}
                  {p.location ? ` · ${p.location}` : ""}
                </div>
                {p.budget && (
                  <div className="text-[11px] text-muted mt-0.5 font-mono">
                    {formatKsh(Number(p.budget))}
                  </div>
                )}
                <div className="mt-3.5">
                  <DimensionBar progress={p.progressPercentage} status={status} />
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blueprint-bg text-blueprint flex items-center justify-center text-[10px] font-semibold">
                      {architect
                        ? `${architect.firstName[0]}${architect.lastName[0]}`
                        : "—"}
                    </div>
                    <span className="text-[11.5px] text-muted">
                      {architect ? `${architect.firstName} ${architect.lastName}` : "Unassigned"}
                    </span>
                  </div>
                  {(!architect || p.status === "DELAYED") && canManage && (
                    <span className="flex items-center gap-1 text-[11px] text-brick font-medium">
                      <Repeat size={12} />
                      Needs attention
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded-md border border-line disabled:opacity-40 hover:bg-vellum"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[12px] text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-md border border-line disabled:opacity-40 hover:bg-vellum"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Create project modal */}
      {createOpen && (
        <CreateProjectModal
          staff={staff}
          currentUserId={user?.id ?? ""}
          onClose={() => { setCreateOpen(false); router.replace("/projects"); }}
          onCreated={(p) => {
            setCreateOpen(false);
            router.push(`/projects/${p.id}`);
          }}
        />
      )}
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsContent />
    </Suspense>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

function CreateProjectModal({
  staff,
  currentUserId,
  onClose,
  onCreated,
}: {
  staff: User[];
  currentUserId: string;
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [budget, setBudget] = useState("");
  const [supervisorId, setSupervisorId] = useState(currentUserId);
  const [architectIds, setArchitectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supervisors = staff.filter((s) => s.role === "ADMIN" || s.role === "SUPERVISOR");
  const architects = staff.filter((s) => s.role === "ARCHITECT" && s.isActive);

  function toggleArchitect(id: string) {
    setArchitectIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  async function handleCreate() {
    if (!name.trim() || !clientName.trim() || !supervisorId) {
      setError("Project name, client name, and supervisor are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const p = await projectsApi.create({
        name,
        clientName,
        clientContact: clientContact || undefined,
        location: location || undefined,
        description: description || undefined,
        startDate: startDate || undefined,
        expectedCompletionDate: dueDate || undefined,
        priority: priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        budget: budget ? Number(budget) : undefined,
        supervisorId,
        architectIds,
      });
      onCreated(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New project" width="lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Project name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Karen Residence" />
        </Field>
        <Field label="Client name" required>
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Mr. & Mrs. Mwangi" />
        </Field>
        <Field label="Client contact">
          <Input value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="Email or phone" />
        </Field>
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Karen, Nairobi" />
        </Field>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Expected completion">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </Select>
        </Field>
        <Field label="Budget (KES)">
          <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="18500000" />
        </Field>
        <Field label="Supervisor" required>
          <Select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
            <option value="">Select supervisor…</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Description" className="mb-4">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Brief description of the project…"
        />
      </Field>

      <div className="mb-4">
        <div className="text-[11.5px] font-medium text-muted mb-2">Assign architects (optional)</div>
        <div className="flex flex-wrap gap-2">
          {architects.length === 0 && (
            <p className="text-[12px] text-muted">No architect accounts yet. <Link href="/staff?new=1" className="text-blueprint">Add staff →</Link></p>
          )}
          {architects.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleArchitect(a.id)}
              className={`px-3 py-1.5 rounded-full text-[11.5px] border transition-colors ${
                architectIds.includes(a.id)
                  ? "bg-blueprint text-white border-blueprint"
                  : "bg-surface text-muted border-line hover:border-blueprint/40"
              }`}
            >
              {a.firstName} {a.lastName}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? "Creating…" : "Create project"}
        </Button>
      </div>
    </Modal>
  );
}
