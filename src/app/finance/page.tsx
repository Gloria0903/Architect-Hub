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
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function FinancePage() {
  const router = useRouter();

  const { data: session, status } = useSession();

  const isAdmin = session?.user?.role === "ADMIN";

  const {
    projects,
    clients,
    payments,
    addPayment,
  } = useStore();

  const [open, setOpen] = useState(false);

  const [selectedProject, setSelectedProject] =
    useState<string | null>(null);

  const [form, setForm] = useState({
    projectId: "",
    amount: "",
    date: "",
    reference: "",
    note: "",
  });

  /*
   * --------------------------------------------------------------------------
   * AUTHENTICATION / AUTHORIZATION GUARD
   * --------------------------------------------------------------------------
   */

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

  /*
   * --------------------------------------------------------------------------
   * FINANCIAL CALCULATION HELPERS
   * --------------------------------------------------------------------------
   *
   * CONTRACT VALUE
   * = project.budget
   *
   * INVOICED
   * = project.invoiced
   *
   * PAID
   * = project.paid
   *
   * OUTSTANDING RECEIVABLE
   * = invoiced - paid
   *
   * UNINVOICED
   * = budget - invoiced
   *
   * REMAINING CONTRACT VALUE
   * = budget - paid
   *
   * IMPORTANT:
   *
   * "Outstanding receivable" and "Remaining contract value" are different.
   *
   * Outstanding receivable:
   *   Money already invoiced but not yet received.
   *
   * Remaining contract value:
   *   Total contract value that has not yet been collected, including
   *   amounts that may not have been invoiced yet.
   * --------------------------------------------------------------------------
   */

  function getContractValue(project: {
    budget?: number | null;
  }) {
    return Math.max(Number(project.budget ?? 0), 0);
  }

  function getInvoiced(project: {
    invoiced?: number | null;
  }) {
    return Math.max(Number(project.invoiced ?? 0), 0);
  }

  function getPaid(project: {
    paid?: number | null;
  }) {
    return Math.max(Number(project.paid ?? 0), 0);
  }

  /**
   * Amount already invoiced but not yet paid.
   */
  function getOutstanding(project: {
    invoiced?: number | null;
    paid?: number | null;
  }) {
    const invoiced = getInvoiced(project);
    const paid = getPaid(project);

    return Math.max(invoiced - paid, 0);
  }

  /**
   * Contract value that has not yet been invoiced.
   */
  function getUninvoiced(project: {
    budget?: number | null;
    invoiced?: number | null;
  }) {
    const contract = getContractValue(project);
    const invoiced = getInvoiced(project);

    return Math.max(contract - invoiced, 0);
  }

  /**
   * Total contract value that has not yet been collected.
   */
  function getRemainingContractValue(project: {
    budget?: number | null;
    paid?: number | null;
  }) {
    const contract = getContractValue(project);
    const paid = getPaid(project);

    return Math.max(contract - paid, 0);
  }

  /*
   * --------------------------------------------------------------------------
   * FINANCIAL TOTALS
   * --------------------------------------------------------------------------
   */

  const totalBudget = projects.reduce(
    (sum, project) => sum + getContractValue(project),
    0
  );

  const totalInvoiced = projects.reduce(
    (sum, project) => sum + getInvoiced(project),
    0
  );

  const totalPaid = projects.reduce(
    (sum, project) => sum + getPaid(project),
    0
  );

  /**
   * Actual accounts receivable.
   *
   * INVOICED - PAID
   */
  const totalOutstanding = Math.max(
    totalInvoiced - totalPaid,
    0
  );

  /**
   * Contract value that has not yet been invoiced.
   */
  const totalUninvoiced = Math.max(
    totalBudget - totalInvoiced,
    0
  );

  /**
   * Total contract value that has not yet been collected.
   *
   * This is NOT the same as outstanding receivable.
   */
  const totalRemainingContract = Math.max(
    totalBudget - totalPaid,
    0
  );

  /**
   * Percentage of contract value that has been invoiced.
   */
  const invoicedPercentage =
    totalBudget > 0
      ? Math.min(
          Math.round(
            (totalInvoiced / totalBudget) * 100
          ),
          100
        )
      : 0;

  /**
   * Percentage of contract value collected.
   */
  const collectedPercentage =
    totalBudget > 0
      ? Math.min(
          Math.round(
            (totalPaid / totalBudget) * 100
          ),
          100
        )
      : 0;

  /**
   * Percentage of invoiced amounts collected.
   */
  const collectionOfInvoicedPercentage =
    totalInvoiced > 0
      ? Math.min(
          Math.round(
            (totalPaid / totalInvoiced) * 100
          ),
          100
        )
      : 0;

  /**
   * Outstanding receivables as a percentage of invoiced value.
   */
  const outstandingPercentage =
    totalInvoiced > 0
      ? Math.min(
          Math.round(
            (totalOutstanding / totalInvoiced) * 100
          ),
          100
        )
      : 0;

  /*
   * --------------------------------------------------------------------------
   * RECORD PAYMENT
   * --------------------------------------------------------------------------
   */

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (
      !form.projectId ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }

    const project = projects.find(
      (item) => item.id === form.projectId
    );

    if (!project) {
      alert(
        "The selected project could not be found."
      );
      return;
    }

    /*
     * Payments are limited to the amount that has actually
     * been invoiced and remains unpaid.
     */
    const outstanding = getOutstanding(project);

    if (outstanding <= 0) {
      alert(
        "This project has no outstanding invoiced balance."
      );
      return;
    }

    if (amount > outstanding) {
      alert(
        `Payment cannot exceed the outstanding invoiced balance of ${formatKsh(
          outstanding
        )}.`
      );
      return;
    }

    try {
      await addPayment({
        projectId: form.projectId,
        amount,
        date: form.date,
        reference: form.reference.trim(),
        note: form.note.trim(),
      });

      setOpen(false);

      setForm({
        projectId: "",
        amount: "",
        date: "",
        reference: "",
        note: "",
      });
    } catch (error) {
      console.error(
        "Failed to record payment:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to record payment."
      );
    }
  }

  /*
   * --------------------------------------------------------------------------
   * PAYMENT HISTORY
   * --------------------------------------------------------------------------
   */

  const projectPayments = selectedProject
    ? payments.filter(
        (payment) =>
          payment.projectId === selectedProject
      )
    : payments;

  /*
   * --------------------------------------------------------------------------
   * RENDER
   * --------------------------------------------------------------------------
   */

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

          <div className="flex items-center gap-2">
          <RefreshButton />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink/90"
          >
            <Plus size={15} />
            Record payment
          </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SUMMARY KPIs */}
        {/* ------------------------------------------------------------------ */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
              {projects.length === 1
                ? "contract"
                : "contracts"}
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
              {invoicedPercentage}% of contract value
            </div>

            <div className="text-muted text-[10px] mt-0.5">
              Uninvoiced:{" "}
              {formatKsh(totalUninvoiced)}
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

              {collectedPercentage}% of contract
            </div>

            <div className="text-muted text-[10px] mt-0.5">
              {collectionOfInvoicedPercentage}% of invoiced
            </div>
          </Card>

          {/* OUTSTANDING */}

          <Card className="p-3.5">
            <div className="text-muted text-[11px]">
              Outstanding receivable
            </div>

            <div className="font-mono font-medium text-[17px] text-brick mt-1">
              {formatKsh(totalOutstanding)}
            </div>

            <div className="flex items-center gap-1 text-brick text-[11px] mt-1">
              <TrendingDown size={12} />

              {outstandingPercentage}% of invoiced
            </div>

            <div className="text-muted text-[10px] mt-0.5">
              Remaining contract:{" "}
              {formatKsh(totalRemainingContract)}
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
                      Progress
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted"
                      >
                        No projects available.
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => {
                      const contractValue =
                        getContractValue(project);

                      const invoiced =
                        getInvoiced(project);

                      const paid =
                        getPaid(project);

                      const outstanding =
                        getOutstanding(project);

                      const uninvoiced =
                        getUninvoiced(project);

                      const remainingContract =
                        getRemainingContractValue(
                          project
                        );

                      /*
                       * Payment progress against total contract value.
                       */
                      const paymentPercentage =
                        contractValue > 0
                          ? Math.min(
                              Math.round(
                                (paid /
                                  contractValue) *
                                  100
                              ),
                              100
                            )
                          : 0;

                      /*
                       * Collection percentage against invoiced value.
                       */
                      const collectionPercentage =
                        invoiced > 0
                          ? Math.min(
                              Math.round(
                                (paid /
                                  invoiced) *
                                  100
                              ),
                              100
                            )
                          : 0;

                      const client = clients.find(
                        (item) =>
                          item.id ===
                          project.clientId
                      );

                      const isSelected =
                        selectedProject ===
                        project.id;

                      return (
                        <tr
                          key={project.id}
                          className={`border-t border-line hover:bg-vellum/40 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blueprint-bg/30"
                              : ""
                          }`}
                          onClick={() =>
                            setSelectedProject(
                              isSelected
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
                              {client?.name ||
                                "No client"}
                            </div>
                          </td>

                          {/* CONTRACT */}

                          <td className="px-4 py-3 text-right font-mono text-[11px]">
                            {formatKsh(
                              contractValue
                            )}
                          </td>

                          {/* INVOICED */}

                          <td className="px-4 py-3 text-right font-mono text-[11px]">
                            {formatKsh(invoiced)}

                            <div className="text-[9px] text-muted mt-0.5">
                              Unbilled:{" "}
                              {formatKsh(
                                uninvoiced
                              )}
                            </div>
                          </td>

                          {/* PAID */}

                          <td className="px-4 py-3 text-right font-mono text-[11px] text-moss">
                            {formatKsh(paid)}

                            <div className="text-[9px] text-muted mt-0.5">
                              {paymentPercentage}% of contract
                            </div>
                          </td>

                          {/* OUTSTANDING */}

                          <td className="px-4 py-3 text-right font-mono text-[11px] text-brick">
                            {formatKsh(
                              outstanding
                            )}

                            <div className="text-[9px] text-muted mt-0.5">
                              {collectionPercentage}% collected
                            </div>
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

                            <div className="text-[9px] text-muted text-right mt-1">
                              Remaining:{" "}
                              {formatKsh(
                                remainingContract
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
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
                  type="button"
                  onClick={() =>
                    setSelectedProject(null)
                  }
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
                  const project =
                    projects.find(
                      (item) =>
                        item.id ===
                        payment.projectId
                    );

                  return (
                    <div
                      key={payment.id}
                      className="px-4 py-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-mono text-[12px] text-moss font-medium">
                          {formatKsh(
                            payment.amount
                          )}
                        </div>

                        <div className="font-mono text-[11px] text-muted">
                          {payment.date}
                        </div>
                      </div>

                      <div className="text-[11.5px] text-ink">
                        {project?.name ||
                          "Unknown project"}
                      </div>

                      <div className="text-[11px] text-muted mt-0.5">
                        {payment.reference ||
                          "No reference"}{" "}
                        ·{" "}
                        {payment.note ||
                          "No note"}
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
                    projectId:
                      e.target.value,
                  }))
                }
              >
                <option value="">
                  Select project
                </option>

                {projects.map((project) => {
                  const outstanding =
                    getOutstanding(project);

                  const invoiced =
                    getInvoiced(project);

                  const paid =
                    getPaid(project);

                  // Only block genuinely settled projects -- invoiced
                  // AND fully paid off. A project that simply hasn't
                  // been invoiced yet (invoiced === 0) still shows
                  // outstanding === 0 by the math, but that's a project
                  // waiting for its first invoice/advance payment, not
                  // one that's done -- it should stay selectable. This
                  // was disabling nearly every active project before.
                  const isFullySettled =
                    invoiced > 0 && outstanding <= 0;

                  return (
                    <option
                      key={project.id}
                      value={project.id}
                      disabled={
                        isFullySettled
                      }
                    >
                      {project.sheetNo} —{" "}
                      {project.name}{" "}
                      (Outstanding:{" "}
                      {formatKsh(
                        outstanding
                      )}{" "}
                      / Invoiced:{" "}
                      {formatKsh(invoiced)}{" "}
                      / Paid:{" "}
                      {formatKsh(paid)})
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
                      amount:
                        e.target.value,
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
                      date:
                        e.target.value,
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
                    reference:
                      e.target.value,
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

            {/* PAYMENT SUMMARY */}

            {form.projectId &&
              (() => {
                const project = projects.find(
                  (item) =>
                    item.id ===
                    form.projectId
                );

                if (!project) {
                  return null;
                }

                const contract =
                  getContractValue(project);

                const invoiced =
                  getInvoiced(project);

                const paid =
                  getPaid(project);

                const outstanding =
                  getOutstanding(project);

                const amount = Number(
                  form.amount || 0
                );

                const remainingAfterPayment =
                  Math.max(
                    outstanding - amount,
                    0
                  );

                return (
                  <div className="rounded-md border border-line bg-vellum/50 p-3 text-[11px]">
                    <div className="font-medium text-ink mb-2">
                      Payment summary
                    </div>

                    <div className="grid grid-cols-2 gap-y-1.5">
                      <div className="text-muted">
                        Contract value
                      </div>

                      <div className="text-right font-mono">
                        {formatKsh(contract)}
                      </div>

                      <div className="text-muted">
                        Total invoiced
                      </div>

                      <div className="text-right font-mono">
                        {formatKsh(invoiced)}
                      </div>

                      <div className="text-muted">
                        Already paid
                      </div>

                      <div className="text-right font-mono text-moss">
                        {formatKsh(paid)}
                      </div>

                      <div className="text-muted">
                        Current outstanding
                      </div>

                      <div className="text-right font-mono text-brick">
                        {formatKsh(
                          outstanding
                        )}
                      </div>

                      {amount > 0 && (
                        <>
                          <div className="text-muted border-t border-line pt-1.5 mt-1.5">
                            This payment
                          </div>

                          <div className="text-right font-mono text-moss border-t border-line pt-1.5 mt-1.5">
                            {formatKsh(amount)}
                          </div>

                          <div className="text-muted">
                            Balance after payment
                          </div>

                          <div className="text-right font-mono font-medium">
                            {formatKsh(
                              remainingAfterPayment
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {amount > outstanding && (
                      <div className="mt-2 text-brick">
                        Payment exceeds the outstanding
                        invoiced balance.
                      </div>
                    )}
                  </div>
                );
              })()}

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
                disabled={(() => {
                  if (
                    !form.projectId ||
                    !form.amount
                  ) {
                    return true;
                  }

                  const amount = Number(
                    form.amount
                  );

                  if (
                    !Number.isFinite(amount) ||
                    amount <= 0
                  ) {
                    return true;
                  }

                  const project =
                    projects.find(
                      (item) =>
                        item.id ===
                        form.projectId
                    );

                  if (!project) {
                    return true;
                  }

                  return (
                    amount >
                    getOutstanding(project)
                  );
                })()}
                className="px-4 py-2 rounded-md text-[12.5px] bg-moss text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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