"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Field, FormRow } from "@/components/ui/form-field";
import { useStore, Client } from "@/store/app-store";
import { Plus, Building2, Mail, Phone, Pencil, Trash2, KeyRound, Copy, Check } from "lucide-react";

const emptyForm = { name: "", contactPerson: "", email: "", phone: "", address: "" };

export default function ClientsPage() {
  const { clients, projects, addClient, updateClient, removeClient } = useStore();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canManage = role === "ADMIN";
  const isAdmin = role === "ADMIN";

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await addClient(form);
      setOpen(false);
      setForm(emptyForm);
    } catch (err) {
      setError((err as Error).message || "Failed to add client");
    }
  }

  function openEdit(id: string) {
    const c = clients.find(cl => cl.id === id)!;
    setForm({ name: c.name, contactPerson: c.contactPerson, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "" });
    setEditTarget(id);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setError("");
    try {
      await updateClient(editTarget, form);
      setEditTarget(null);
      setForm(emptyForm);
    } catch (err) {
      setError((err as Error).message || "Failed to update client");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete client "${name}"? This only works if they have no projects.`)) return;
    try {
      await removeClient(id);
    } catch (err) {
      alert((err as Error).message || "Failed to delete client");
    }
  }

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Clients</h1>
            <p className="text-muted text-[12px] mt-0.5">{clients.length} registered clients</p>
          </div>
          {canManage && (
            <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90">
              <Plus size={15} />Add client
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);
            return (
              <Card key={client.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ochre-bg text-ochre flex items-center justify-center">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-[14px] text-ink">{client.name}</div>
                      <div className="text-muted text-[11.5px]">{client.contactPerson}</div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openEdit(client.id)} className="text-muted hover:text-blueprint" title="Edit"><Pencil size={14} /></button>
                      {isAdmin && <button onClick={() => handleDelete(client.id, client.name)} className="text-muted hover:text-brick" title="Delete"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 text-[12px] mb-3">
                  <div className="flex items-center gap-2 text-muted"><Mail size={12} />{client.email || "—"}</div>
                  <div className="flex items-center gap-2 text-muted"><Phone size={12} />{client.phone || "—"}</div>
                </div>
                {isAdmin && <ClientPortalAccess client={client} />}
                <div className="border-t border-line pt-3">
                  <div className="text-[11px] text-muted mb-2">Projects ({clientProjects.length})</div>
                  {clientProjects.length === 0
                    ? <div className="text-[11.5px] text-muted">No projects yet</div>
                    : clientProjects.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-[11.5px] mb-1">
                        <span className="font-mono text-muted">{p.sheetNo}</span>
                        <span className="text-ink">{p.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.status === "ON_TRACK" ? "bg-moss-bg text-moss" : p.status === "AT_RISK" ? "bg-ochre-bg text-ochre" : "bg-brick-bg text-brick"}`}>
                          {p.progress}%
                        </span>
                      </div>
                    ))
                  }
                </div>
              </Card>
            );
          })}
        </div>

        <Modal open={open} onClose={() => setOpen(false)} title="Add new client">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <Field label="Organisation / client name" required>
              <Input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Aurora Properties Ltd" />
            </Field>
            <Field label="Contact person" required>
              <Input required value={form.contactPerson} onChange={e => setForm(f=>({...f,contactPerson:e.target.value}))} placeholder="e.g. Sarah Njoroge" />
            </Field>
            <FormRow>
              <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="contact@company.com" /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="+254 7XX XXX XXX" /></Field>
            </FormRow>
            <Field label="Address"><Input value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} placeholder="e.g. Westlands, Nairobi" /></Field>
            {error && <p className="text-brick text-[12px]">{error}</p>}
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Add client</button>
            </div>
          </form>
        </Modal>

        <Modal open={!!editTarget} onClose={() => { setEditTarget(null); setForm(emptyForm); }} title="Edit client">
          <form onSubmit={handleEdit} className="flex flex-col gap-3.5">
            <Field label="Organisation / client name" required>
              <Input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
            </Field>
            <Field label="Contact person" required>
              <Input required value={form.contactPerson} onChange={e => setForm(f=>({...f,contactPerson:e.target.value}))} />
            </Field>
            <FormRow>
              <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} /></Field>
            </FormRow>
            <Field label="Address"><Input value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} /></Field>
            {error && <p className="text-brick text-[12px]">{error}</p>}
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => { setEditTarget(null); setForm(emptyForm); }} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Save changes</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

/**
 * Admin-only control on each client card: flip portal access on/off and
 * (re)issue a login password. Deliberately its own fetch, not routed
 * through the central store — this is a narrow, admin-only side action on
 * a record the store already owns, not a shape the rest of the app reads.
 */
function ClientPortalAccess({ client }: { client: Client }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [enabled, setEnabled] = useState(Boolean(client.portalEnabled));

  async function callPortalApi(body: { portalEnabled: boolean; password?: string }) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/portal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update portal access");
      setEnabled(data.portalEnabled);
      if (data.temporaryPassword) setTempPassword(data.temporaryPassword);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-t border-line pt-3 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted"><KeyRound size={12} />Client Portal</div>
        <button
          disabled={busy || (!enabled && !client.email)}
          onClick={() => callPortalApi({ portalEnabled: !enabled })}
          title={!client.email ? "Add a client email first" : undefined}
          className={`text-[10.5px] px-2 py-0.5 rounded-[3px] font-medium disabled:opacity-40 ${enabled ? "bg-moss-bg text-moss" : "bg-vellum text-muted border border-line"}`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </button>
      </div>
      {enabled && (
        <button
          disabled={busy}
          onClick={() => callPortalApi({ portalEnabled: true, password: "" })}
          className="text-[11px] text-blueprint mt-1.5 hover:underline disabled:opacity-40"
        >
          Issue new portal password
        </button>
      )}
      {error && <p className="text-brick text-[11px] mt-1">{error}</p>}
      {tempPassword && (
        <div className="mt-2 bg-vellum border border-line rounded-md p-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] text-muted">Share this with the client securely — shown once:</div>
            <div className="font-mono text-[12px] text-ink">{tempPassword}</div>
          </div>
          <button onClick={handleCopy} className="text-muted hover:text-blueprint shrink-0" title="Copy">
            {copied ? <Check size={14} className="text-moss" /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
