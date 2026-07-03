"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Button, ErrorBanner, SuccessBanner, Spinner, EmptyState } from "@/components/ui/form";
import { projects as projectsApi, finance as financeApi, Project, FinancialRecord, formatKsh, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { Wallet, AlertCircle } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  PAID: "text-moss",
  OVERDUE: "text-brick font-semibold",
  PARTIALLY_PAID: "text-ochre",
  INVOICED: "text-blueprint",
  NOT_INVOICED: "text-muted",
};
const STATUS_LABEL: Record<string, string> = {
  PAID: "Paid",
  OVERDUE: "Overdue",
  PARTIALLY_PAID: "Partial",
  INVOICED: "Invoiced",
  NOT_INVOICED: "Not invoiced",
};

interface ProjectWithFinance extends Omit<Project, "financialRecord"> {
  financialRecord: FinancialRecord | null;
}

export default function FinancePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [rows, setRows] = useState<ProjectWithFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    totalInvoiced: number; totalPaid: number; totalOutstanding: number;
    overdueCount: number; monthlyRevenue: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<ProjectWithFinance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projResult, firmSummary] = await Promise.all([
        projectsApi.list({ pageSize: 100 }),
        financeApi.firmSummary(),
      ]);
      const withFinance: ProjectWithFinance[] = await Promise.all(
        projResult.data.map(async (p) => {
          const fin = await financeApi.getProject(p.id).catch(() => null);
          return { ...p, financialRecord: fin };
        }),
      );
      setRows(withFinance);
      setSummary(firmSummary);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load financial data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (authLoading) return <AppShell><Spinner /></AppShell>;

  const billed = rows.filter((r) => r.financialRecord && r.financialRecord.paymentStatus !== "NOT_INVOICED");
  const overdue = rows.filter((r) => r.financialRecord?.paymentStatus === "OVERDUE");

  return (
    <AppShell>
      <Topbar title="Finance" subtitle="Contract values, invoicing and payment tracking" />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Monthly revenue</div>
          <div className="font-mono font-medium text-[19px] text-moss mt-1">
            {summary ? formatKsh(summary.monthlyRevenue) : "—"}
          </div>
          <div className="text-muted text-[11px] mt-1">This month, paid</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Total invoiced</div>
          <div className="font-mono font-medium text-[19px] text-ink mt-1">
            {summary ? formatKsh(summary.totalInvoiced) : "—"}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Total paid</div>
          <div className="font-mono font-medium text-[19px] text-ink mt-1">
            {summary ? formatKsh(summary.totalPaid) : "—"}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-muted text-[11px]">Outstanding</div>
          <div className={`font-mono font-medium text-[19px] mt-1 ${(summary?.totalOutstanding ?? 0) > 0 ? "text-brick" : "text-ink"}`}>
            {summary ? formatKsh(summary.totalOutstanding) : "—"}
          </div>
          {(summary?.overdueCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-brick text-[11px] mt-1">
              <AlertCircle size={11} /> {summary?.overdueCount} overdue
            </div>
          )}
        </Card>
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-brick-bg border border-brick/20 rounded-md px-4 py-2.5 text-[12px] text-brick">
          <AlertCircle size={14} />
          {overdue.length} project{overdue.length > 1 ? "s are" : " is"} overdue for payment:{" "}
          {overdue.map((p) => p.name).join(", ")}
        </div>
      )}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={28} />}
            title="No projects yet"
            body="Create projects and add financial records to track invoicing and payments here."
          />
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-[12.5px] font-medium text-ink">All projects — financial summary</span>
            <span className="text-[11px] text-muted">{billed.length} of {rows.length} billed</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium text-right">Contract</th>
                  <th className="px-4 py-3 font-medium text-right">Invoiced</th>
                  <th className="px-4 py-3 font-medium text-right">Paid</th>
                  <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const fin = p.financialRecord;
                  const outstanding = fin
                    ? Number(fin.amountInvoiced) - Number(fin.amountPaid)
                    : null;
                  return (
                    <tr key={p.id} className="border-t border-line hover:bg-vellum">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{p.name}</div>
                        <div className="font-mono text-[10.5px] text-muted">{p.projectNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">{p.clientName}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {fin ? formatKsh(Number(fin.contractValue)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {fin ? formatKsh(Number(fin.amountInvoiced)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-moss">
                        {fin ? formatKsh(Number(fin.amountPaid)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-brick">
                        {outstanding !== null && outstanding > 0 ? formatKsh(outstanding) : fin ? "—" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {fin ? (
                          <span className={`text-[11px] ${STATUS_STYLE[fin.paymentStatus] ?? "text-muted"}`}>
                            {STATUS_LABEL[fin.paymentStatus] ?? fin.paymentStatus}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">No record</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditProject(p)}
                          className="text-[11.5px] text-blueprint hover:underline"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editProject && (
        <UpdatePaymentModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={() => { setEditProject(null); load(); }}
        />
      )}
    </AppShell>
  );
}

// ─── Update payment modal ─────────────────────────────────────────────────────

function UpdatePaymentModal({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectWithFinance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fin = project.financialRecord;
  const [contractValue, setContractValue] = useState(fin ? String(Number(fin.contractValue)) : "");
  const [amountInvoiced, setAmountInvoiced] = useState(fin ? String(Number(fin.amountInvoiced)) : "");
  const [amountPaid, setAmountPaid] = useState(fin ? String(Number(fin.amountPaid)) : "");
  const [paymentDueDate, setPaymentDueDate] = useState(fin?.paymentDueDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const outstanding = Number(amountInvoiced || 0) - Number(amountPaid || 0);

  async function handleSave() {
    if (!contractValue) { setError("Contract value is required."); return; }
    setSaving(true); setError(null); setSuccess(false);
    try {
      await financeApi.upsertProject(project.id, {
        contractValue: Number(contractValue),
        amountInvoiced: amountInvoiced ? Number(amountInvoiced) : undefined,
        amountPaid: amountPaid ? Number(amountPaid) : undefined,
        paymentDueDate: paymentDueDate || undefined,
      });
      setSuccess(true);
      setTimeout(onSaved, 600);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update payment — ${project.name}`}
      subtitle={`${project.clientName} · ${project.projectNumber}`}
    >
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Contract value (KES)" required>
          <Input type="number" value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="18500000" />
        </Field>
        <Field label="Amount invoiced (KES)">
          <Input type="number" value={amountInvoiced} onChange={(e) => setAmountInvoiced(e.target.value)} placeholder="11000000" />
        </Field>
        <Field label="Amount paid (KES)">
          <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="9200000" />
        </Field>
        <Field label="Payment due date">
          <Input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} />
        </Field>
      </div>

      {/* Live outstanding calculation */}
      <div className="flex items-center justify-between bg-vellum rounded-md px-4 py-3 mb-4 text-[12px]">
        <span className="text-muted">Outstanding balance</span>
        <span className={`font-mono font-medium ${outstanding > 0 ? "text-brick" : "text-moss"}`}>
          {formatKsh(outstanding)}
        </span>
      </div>

      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
      {success && <div className="mb-3"><SuccessBanner message="Payment record updated." /></div>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save payment record"}
        </Button>
      </div>
    </Modal>
  );
}
