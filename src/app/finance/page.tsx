"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea, Field, FormRow } from "@/components/ui/form-field";
import { useStore, formatKsh } from "@/store/app-store";
import { Plus, TrendingUp, TrendingDown, Clock } from "lucide-react";

export default function FinancePage() {
  const { projects, clients, staff, payments, addPayment } = useStore();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [form, setForm] = useState({ projectId: "", amount: "", date: "", reference: "", note: "" });

  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalInvoiced = projects.reduce((s, p) => s + p.invoiced, 0);
  const totalPaid = projects.reduce((s, p) => s + p.paid, 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addPayment({
      projectId: form.projectId,
      amount: Number(form.amount),
      date: form.date,
      reference: form.reference,
      note: form.note,
    });
    setOpen(false);
    setForm({ projectId: "", amount: "", date: "", reference: "", note: "" });
  }

  const projectPayments = selectedProject ? payments.filter(p => p.projectId === selectedProject) : payments;

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Finance</h1>
            <p className="text-muted text-[12px] mt-0.5">Payment tracking across all projects</p>
          </div>
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90">
            <Plus size={15} />Record payment
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Total contract value</div>
            <div className="font-mono font-medium text-[17px] text-ink mt-1">{formatKsh(totalBudget)}</div>
            <div className="flex items-center gap-1 text-blueprint text-[11px] mt-1"><TrendingUp size={12} />{projects.length} contracts</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Total invoiced</div>
            <div className="font-mono font-medium text-[17px] text-ink mt-1">{formatKsh(totalInvoiced)}</div>
            <div className="text-muted text-[11px] mt-1">{Math.round((totalInvoiced/totalBudget)*100)}% of contracts</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Total received</div>
            <div className="font-mono font-medium text-[17px] text-moss mt-1">{formatKsh(totalPaid)}</div>
            <div className="flex items-center gap-1 text-moss text-[11px] mt-1"><TrendingUp size={12} />{Math.round((totalPaid/totalInvoiced)*100)}% collected</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">Outstanding</div>
            <div className="font-mono font-medium text-[17px] text-brick mt-1">{formatKsh(totalOutstanding)}</div>
            <div className="flex items-center gap-1 text-brick text-[11px] mt-1"><TrendingDown size={12} />Awaiting payment</div>
          </Card>
        </div>

        {/* Per-project breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-line font-medium text-ink text-[12.5px]">Project financial summary</div>
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-vellum">
                <tr className="text-muted text-left">
                  <th className="font-medium px-4 py-2.5">Project</th>
                  <th className="font-medium px-4 py-2.5 text-right">Contract</th>
                  <th className="font-medium px-4 py-2.5 text-right">Invoiced</th>
                  <th className="font-medium px-4 py-2.5 text-right">Paid</th>
                  <th className="font-medium px-4 py-2.5 text-right">Outstanding</th>
                  <th className="font-medium px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const outstanding = p.invoiced - p.paid;
                  const client = clients.find(c => c.id === p.clientId);
                  return (
                    <tr key={p.id} className={`border-t border-line hover:bg-vellum/40 cursor-pointer transition-colors ${selectedProject === p.id ? "bg-blueprint-bg/30" : ""}`} onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}>
                      <td className="px-4 py-3">
                        <div className="text-ink font-medium">{p.name}</div>
                        <div className="text-muted text-[11px] font-mono">{p.sheetNo} · {client?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px]">{formatKsh(p.budget)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[11px]">{formatKsh(p.invoiced)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-moss">{formatKsh(p.paid)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-brick">{formatKsh(outstanding)}</td>
                      <td className="px-4 py-3">
                        <div className="w-16 h-1.5 bg-line rounded-full overflow-hidden ml-auto">
                          <div className="h-full bg-moss rounded-full" style={{ width: `${Math.round((p.paid/p.invoiced||0)*100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="font-medium text-ink text-[12.5px]">Payment history</div>
              {selectedProject && <button onClick={() => setSelectedProject(null)} className="text-[11px] text-muted">Clear filter</button>}
            </div>
            <div className="divide-y divide-line max-h-96 overflow-y-auto">
              {projectPayments.length === 0
                ? <div className="p-6 text-center text-muted text-[12.5px]">No payments recorded yet.</div>
                : projectPayments.map(pay => {
                  const project = projects.find(p => p.id === pay.projectId);
                  return (
                    <div key={pay.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-mono text-[12px] text-moss font-medium">{formatKsh(pay.amount)}</div>
                        <div className="font-mono text-[11px] text-muted">{pay.date}</div>
                      </div>
                      <div className="text-[11.5px] text-ink">{project?.name}</div>
                      <div className="text-[11px] text-muted mt-0.5">{pay.reference} · {pay.note}</div>
                    </div>
                  );
                })
              }
            </div>
          </Card>
        </div>

        {/* Record Payment Modal */}
        <Modal open={open} onClose={() => setOpen(false)} title="Record payment" subtitle="This will update the project's paid balance">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <Field label="Project" required>
              <Select required value={form.projectId} onChange={e => setForm(f=>({...f,projectId:e.target.value}))}>
                <option value="">Select project</option>
                {projects.map(p => {
                  const outstanding = p.invoiced - p.paid;
                  return <option key={p.id} value={p.id}>{p.sheetNo} — {p.name} (Outstanding: {formatKsh(outstanding)})</option>;
                })}
              </Select>
            </Field>
            <FormRow>
              <Field label="Amount (KSh)" required><Input type="number" required value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="e.g. 2500000" /></Field>
              <Field label="Payment date" required><Input type="date" required value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} /></Field>
            </FormRow>
            <Field label="Reference number"><Input value={form.reference} onChange={e => setForm(f=>({...f,reference:e.target.value}))} placeholder="e.g. INV-A101-003" /></Field>
            <Field label="Note"><Textarea rows={2} value={form.note} onChange={e => setForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Second stage payment…" /></Field>
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-moss text-white font-medium">Record payment</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
