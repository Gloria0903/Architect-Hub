"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Field, FormRow } from "@/components/ui/form-field";
import { useStore } from "@/store/app-store";
import { Plus, Building2, Mail, Phone } from "lucide-react";

export default function ClientsPage() {
  const { clients, projects, addClient } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "", address: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addClient(form);
    setOpen(false);
    setForm({ name: "", contactPerson: "", email: "", phone: "", address: "" });
  }

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Clients</h1>
            <p className="text-muted text-[12px] mt-0.5">{clients.length} registered clients</p>
          </div>
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90">
            <Plus size={15} />Add client
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);
            return (
              <Card key={client.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-ochre-bg text-ochre flex items-center justify-center">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-[14px] text-ink">{client.name}</div>
                    <div className="text-muted text-[11.5px]">{client.contactPerson}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 text-[12px] mb-3">
                  <div className="flex items-center gap-2 text-muted"><Mail size={12} />{client.email}</div>
                  <div className="flex items-center gap-2 text-muted"><Phone size={12} />{client.phone}</div>
                </div>
                <div className="border-t border-line pt-3">
                  <div className="text-[11px] text-muted mb-2">Projects ({clientProjects.length})</div>
                  {clientProjects.length === 0
                    ? <div className="text-[11.5px] text-muted">No projects yet</div>
                    : clientProjects.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-[11.5px] mb-1">
                        <span className="font-mono text-muted">{p.sheetNo}</span>
                        <span className="text-ink">{p.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.status === "on_track" ? "bg-moss-bg text-moss" : p.status === "at_risk" ? "bg-ochre-bg text-ochre" : "bg-brick-bg text-brick"}`}>
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
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Add client</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
