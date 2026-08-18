"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Input,
  Select,
  Textarea,
  Field,
  FormRow,
} from "@/components/ui/form-field";
import { useStore, formatKsh } from "@/store/app-store";
import {
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function FinancePage() {
  const router = useRouter();

const {
  data: session,
  status,
} = useSession();

const isAdmin = session?.user?.role === "ADMIN";

useEffect(() => {
  if (status === "authenticated" && !isAdmin) {
    router.replace("/dashboard");
  }
}, [status, isAdmin, router]);

if (status === "loading") {
  return null;
}

if (!session || !isAdmin) {
  return null;
}
  const {
    projects,
    clients,
    payments,
    addPayment,
  } = useStore();

  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const [form, setForm] = useState({
    projectId: "",
    amount: "",
    date: "",
    reference: "",
    note: "",
  });

  /*
   * --------------------------------------------------------------------------
   * FINANCIAL TOTALS
   *
   * Contract value = project.budget
   * Paid          = project.paid
   * Outstanding   = contract value - paid
   *
   * We intentionally do NOT use invoiced for outstanding because the current
   * project creation flow does not have an invoice entry mechanism yet.
   * --------------------------------------------------------------------------
   */

  const totalBudget = projects.reduce(
    (sum, project) => sum + Number(project.budget || 0),
    0
  );

  const totalInvoiced = projects.reduce(
    (sum, project) => sum + Number(project.invoiced || 0),
    0
  );

  const totalPaid = projects.reduce(
    (sum, project) => sum + Number(project.paid || 0),
    0
  );

  const totalOutstanding = Math.max(
    totalBudget - totalPaid,
    0
  );

  const invoicedPercentage =
    totalBudget > 0
      ? Math.min(Math.round((totalInvoiced / totalBudget) * 100), 100)
      : 0;

  const collectedPercentage =
    totalBudget > 0
      ? Math.min(Math.round((totalPaid / totalBudget) * 100), 100)
      : 0;
  
  const outstandingPercentage =
  totalBudget > 0
    ? Math.min(
        Math.round((totalOutstanding / totalBudget) * 100),
        100
      )
    : 0;    

  /*
   * --------------------------------------------------------------------------
   * RECORD PAYMENT
   * --------------------------------------------------------------------------
   */

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (!form.projectId || !amount || amount <= 0) {
      return;
    }

    const project = projects.find(
      (project) => project.id === form.projectId
    );

    if (!project) {
      return;
    }

    const outstanding = Math.max(
      Number(project.budget || 0) - Number(project.paid || 0),
      0
    );

    if (amount > outstanding) {
      alert(
        `Payment cannot exceed the outstanding contract balance of ${formatKsh(
          outstanding
        )}.`
      );
      return;
    }

    addPayment({
      projectId: form.projectId,
      amount,
      date: form.date,
      reference: form.reference,
      note: form.note,
    });

    setOpen(false);

    setForm({
      projectId: "",
      amount: "",
      date: "",
      reference: "",
      note: "",
    });
  }

  /*
   * --------------------------------------------------------------------------
   * PAYMENT HISTORY
   * --------------------------------------------------------------------------
   */

  const projectPayments = selectedProject
    ? payments.filter(
        (payment) => payment.projectId === selectedProject
      )
    : payments;

  return (
    <AppShell>
      <div>
        {/* ------------------------------------------------------------------ */}
        {/* HEADER */}
        {/* ------------------------------------------------------------------ */}

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">
              Finance
            </h1>

            <p className="text-muted text-[12px] mt-0.5">
              Payment tracking across all projects
            </p>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90"
          >
            <Plus size={15} />
            Record payment
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SUMMARY KPIs */}
        {/* ------------------------------------------------------------------ */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

          {/* CONTRACT VALUE */}
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">
              Total contract value
            </div>

            <div className="font-mono font-medium text-[17px] text-ink mt-1">
              {formatKsh(totalBudget)}
            </div>

            <div className="flex items-center gap-1 text-blueprint text-[11px] mt-1">
              <TrendingUp size={12} />
              {projects.length}{" "}
              {projects.length === 1 ? "contract" : "contracts"}
            </div>
          </Card>

          {/* INVOICED */}
          <Card className="p-3.5">
            <div className="text-muted text-[11px]">
              Total invoiced
            </div>

            <div className="font-mono font-medium text-[17px] text-ink mt-1">
              {formatKsh(totalInvoiced)}
            </div>

            <div className="text-muted text-[11px] mt-1">
              {invoicedPercentage}% of contracts
            </div>
          </Card>

          {/* RECEIVED */}
<Card className="p-3.5">
  <div className="text-muted text-[11px]">
    Total received
  </div>

  <div className="font-mono font-medium text-[17px] text-moss mt-1">
    {formatKsh(totalPaid)}
  </div>

  <div className="flex items-center gap-1 text-moss text-[11px] mt-1">
    <TrendingUp size={12} />
    {collectedPercentage}% collected
  </div>
</Card>

          {/* OUTSTANDING */}
<Card className="p-3.5">
  <div className="text-muted text-[11px]">
    Outstanding
  </div>

  <div className="font-mono font-medium text-[17px] text-brick mt-1">
    {formatKsh(totalOutstanding)}
  </div>

  <div className="flex items-center gap-1 text-brick text-[11px] mt-1">
    <TrendingDown size={12} />

    {outstandingPercentage}% outstanding
  </div>
</Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PROJECT FINANCIAL SUMMARY + PAYMENT HISTORY */}
        {/* ------------------------------------------------------------------ */}

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">

          {/* PROJECT FINANCIAL SUMMARY */}
          <Card className="overflow-hidden">

            <div className="px-4 py-3 border-b border-line font-medium text-ink text-[12.5px]">
              Project financial summary
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">

                <thead className="bg-vellum">
                  <tr className="text-muted text-left">

                    <th className="font-medium px-4 py-2.5">
                      Project
                    </th>

                    <th className="font-medium px-4 py-2.5 text-right">
                      Contract
                    </th>

                    <th className="font-medium px-4 py-2.5 text-right">
                      Invoiced
                    </th>

                    <th className="font-medium px-4 py-2.5 text-right">
                      Paid
                    </th>

                    <th className="font-medium px-4 py-2.5 text-right">
                      Outstanding
                    </th>

                    <th className="font-medium px-4 py-2.5">
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {projects.map((project) => {

                    const contractValue = Number(
                      project.budget || 0
                    );

                    const invoiced = Number(
                      project.invoiced || 0
                    );

                    const paid = Number(
                      project.paid || 0
                    );

                    const outstanding = Math.max(
                      contractValue - paid,
                      0
                    );

                    const paymentPercentage =
                      contractValue > 0
                        ? Math.min(
                            Math.round(
                              (paid / contractValue) * 100
                            ),
                            100
                          )
                        : 0;

                    const client = clients.find(
                      (c) => c.id === project.clientId
                    );

                    return (
                      <tr
                        key={project.id}
                        className={`border-t border-line hover:bg-vellum/40 cursor-pointer transition-colors ${
                          selectedProject === project.id
                            ? "bg-blueprint-bg/30"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedProject(
                            selectedProject === project.id
                              ? null
                              : project.id
                          )
                        }
                      >

                        {/* PROJECT */}
                        <td className="px-4 py-3">

                          <div className="text-ink font-medium">
                            {project.name}
                          </div>

                          <div className="text-muted text-[11px] font-mono">
                            {project.sheetNo} ·{" "}
                            {client?.name || "No client"}
                          </div>

                        </td>

                        {/* CONTRACT */}
                        <td className="px-4 py-3 text-right font-mono text-[11px]">
                          {formatKsh(contractValue)}
                        </td>

                        {/* INVOICED */}
                        <td className="px-4 py-3 text-right font-mono text-[11px]">
                          {formatKsh(invoiced)}
                        </td>

                        {/* PAID */}
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-moss">
                          {formatKsh(paid)}
                        </td>

                        {/* OUTSTANDING */}
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-brick">
                          {formatKsh(outstanding)}
                        </td>

                        {/* PROGRESS */}
                        <td className="px-4 py-3">

                          <div className="w-16 h-1.5 bg-line rounded-full overflow-hidden ml-auto">

                            <div
                              className="h-full bg-moss rounded-full"
                              style={{
                                width: `${paymentPercentage}%`,
                              }}
                            />

                          </div>

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>
            </div>

          </Card>

          {/* PAYMENT HISTORY */}
          <Card className="overflow-hidden">

            <div className="px-4 py-3 border-b border-line flex items-center justify-between">

              <div className="font-medium text-ink text-[12.5px]">
                Payment history
              </div>

              {selectedProject && (
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-[11px] text-muted hover:text-ink"
                >
                  Clear filter
                </button>
              )}

            </div>

            <div className="divide-y divide-line max-h-96 overflow-y-auto">

              {projectPayments.length === 0 ? (

                <div className="p-6 text-center text-muted text-[12.5px]">
                  No payments recorded yet.
                </div>

              ) : (

                projectPayments.map((payment) => {

                  const project = projects.find(
                    (p) => p.id === payment.projectId
                  );

                  return (
                    <div
                      key={payment.id}
                      className="px-4 py-3"
                    >

                      <div className="flex items-center justify-between mb-1">

                        <div className="font-mono text-[12px] text-moss font-medium">
                          {formatKsh(payment.amount)}
                        </div>

                        <div className="font-mono text-[11px] text-muted">
                          {payment.date}
                        </div>

                      </div>

                      <div className="text-[11.5px] text-ink">
                        {project?.name || "Unknown project"}
                      </div>

                      <div className="text-[11px] text-muted mt-0.5">
                        {payment.reference || "No reference"} ·{" "}
                        {payment.note || "No note"}
                      </div>

                    </div>
                  );
                })

              )}

            </div>

          </Card>

        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RECORD PAYMENT MODAL */}
        {/* ------------------------------------------------------------------ */}

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Record payment"
          subtitle="This will update the project's paid balance"
        >

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3.5"
          >

            {/* PROJECT */}
            <Field label="Project" required>

              <Select
                required
                value={form.projectId}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    projectId: e.target.value,
                  }))
                }
              >

                <option value="">
                  Select project
                </option>

                {projects.map((project) => {

                  const outstanding = Math.max(
                    Number(project.budget || 0) -
                      Number(project.paid || 0),
                    0
                  );

                  return (
                    <option
                      key={project.id}
                      value={project.id}
                    >
                      {project.sheetNo} — {project.name}{" "}
                      (Outstanding: {formatKsh(outstanding)})
                    </option>
                  );
                })}

              </Select>

            </Field>

            {/* AMOUNT + DATE */}
            <FormRow>

              <Field
                label="Amount (KSh)"
                required
              >
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="e.g. 2500000"
                />
              </Field>

              <Field
                label="Payment date"
                required
              >
                <Input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      date: e.target.value,
                    }))
                  }
                />
              </Field>

            </FormRow>

            {/* REFERENCE */}
            <Field label="Reference number">

              <Input
                value={form.reference}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    reference: e.target.value,
                  }))
                }
                placeholder="e.g. PAY-A101-003"
              />

            </Field>

            {/* NOTE */}
            <Field label="Note">

              <Textarea
                rows={2}
                value={form.note}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    note: e.target.value,
                  }))
                }
                placeholder="e.g. Second stage payment..."
              />

            </Field>

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted hover:bg-vellum"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-md text-[12.5px] bg-moss text-white font-medium hover:opacity-90"
              >
                Record payment
              </button>

            </div>

          </form>

        </Modal>

      </div>
    </AppShell>
  );
}