"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Printer, FileBarChart, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

type ReportProject = {
  id: string;
  sheetNo: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
  startDate: string;
  dueDate: string;
  budget?: number;
  invoiced?: number;
  paid?: number;
  outstanding?: number;
  client: { name: string } | null;
  architect: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  DELAYED: "Delayed",
  COMPLETED: "Completed",
};

const STATUS_COLOR: Record<string, string> = {
  ON_TRACK: "text-moss",
  AT_RISK: "text-ochre",
  DELAYED: "text-brick",
  COMPLETED: "text-blueprint",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [projects, setProjects] = useState<ReportProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("KES");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projectsRes, firmRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/settings/firm"),
        ]);
        const projectsJson = await projectsRes.json();
        if (!projectsRes.ok) throw new Error(projectsJson?.error ?? "Failed to load projects");
        if (firmRes.ok) {
          const firmJson = await firmRes.json();
          if (!cancelled) setCurrency(firmJson?.currency ?? "KES");
        }
        if (!cancelled) setProjects(projectsJson);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load report data");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = projects?.reduce(
    (acc, p) => ({
      budget: acc.budget + (p.budget ?? 0),
      invoiced: acc.invoiced + (p.invoiced ?? 0),
      paid: acc.paid + (p.paid ?? 0),
      outstanding: acc.outstanding + (p.outstanding ?? Math.max((p.budget ?? 0) - (p.paid ?? 0), 0)),
    }),
    { budget: 0, invoiced: 0, paid: 0, outstanding: 0 }
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div>
          <h1 className="font-display font-bold text-[20px] text-ink flex items-center gap-2">
            <FileBarChart size={20} className="text-blueprint" />
            Reports
          </h1>
          <p className="text-[12.5px] text-muted mt-0.5">Project status and financial summary — printable</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-ink-solid text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink-solid/90"
        >
          <Printer size={15} />
          Print report
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-brick-bg border border-brick/20 rounded-card p-4 mb-5 text-[12.5px] text-brick">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!projects && !error && (
        <div className="flex items-center justify-center h-48 text-muted text-[13px]">Loading report data…</div>
      )}

      {projects && (
        <div className="space-y-8">
          {/* Print-only letterhead */}
          <div className="hidden print:block mb-2">
            <h1 className="font-display font-bold text-[18px] text-ink">Project & Financial Report</h1>
            <p className="text-[11.5px] text-muted">Generated {formatDate(new Date().toISOString())}</p>
          </div>

          {/* Project status */}
          <section className="print-section">
            <h2 className="font-display font-semibold text-[15px] text-ink mb-3">Project status</h2>
            <div className="bg-surface border border-line rounded-card overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line bg-vellum/50">
                    <th className="text-left font-medium text-muted px-4 py-2.5">Sheet</th>
                    <th className="text-left font-medium text-muted px-4 py-2.5">Project</th>
                    <th className="text-left font-medium text-muted px-4 py-2.5">Client</th>
                    <th className="text-left font-medium text-muted px-4 py-2.5">Architect</th>
                    <th className="text-left font-medium text-muted px-4 py-2.5">Status</th>
                    <th className="text-left font-medium text-muted px-4 py-2.5">Progress</th>
                    <th className="text-left font-medium text-muted px-4 py-2.5">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-mono text-ink">{p.sheetNo}</td>
                      <td className="px-4 py-2.5 text-ink font-medium">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted">{p.client?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted">{p.architect?.name ?? "Unassigned"}</td>
                      <td className={`px-4 py-2.5 font-medium ${STATUS_COLOR[p.status] ?? "text-muted"}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </td>
                      <td className="px-4 py-2.5 text-ink">{p.progress}%</td>
                      <td className="px-4 py-2.5 text-muted">{formatDate(p.dueDate)}</td>
                    </tr>
                  ))}
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted">
                        No projects to report on.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Financial summary -- admin only, matching every other financial view in the app */}
          {isAdmin && totals && (
            <section className="print-section">
              <h2 className="font-display font-semibold text-[15px] text-ink mb-3">Financial summary</h2>

              <div className="grid grid-cols-4 gap-3 mb-4 print:grid-cols-4">
                <div className="bg-surface border border-line rounded-card p-3.5">
                  <p className="text-[10.5px] text-muted uppercase tracking-wide">Total contract value</p>
                  <p className="text-[16px] font-mono font-semibold text-ink mt-1">{formatMoney(totals.budget, currency)}</p>
                </div>
                <div className="bg-surface border border-line rounded-card p-3.5">
                  <p className="text-[10.5px] text-muted uppercase tracking-wide">Total invoiced</p>
                  <p className="text-[16px] font-mono font-semibold text-ink mt-1">{formatMoney(totals.invoiced, currency)}</p>
                </div>
                <div className="bg-surface border border-line rounded-card p-3.5">
                  <p className="text-[10.5px] text-muted uppercase tracking-wide">Total received</p>
                  <p className="text-[16px] font-mono font-semibold text-moss mt-1">{formatMoney(totals.paid, currency)}</p>
                </div>
                <div className="bg-surface border border-line rounded-card p-3.5">
                  <p className="text-[10.5px] text-muted uppercase tracking-wide">Outstanding</p>
                  <p className="text-[16px] font-mono font-semibold text-brick mt-1">{formatMoney(totals.outstanding, currency)}</p>
                </div>
              </div>

              <div className="bg-surface border border-line rounded-card overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line bg-vellum/50">
                      <th className="text-left font-medium text-muted px-4 py-2.5">Project</th>
                      <th className="text-right font-medium text-muted px-4 py-2.5">Contract</th>
                      <th className="text-right font-medium text-muted px-4 py-2.5">Invoiced</th>
                      <th className="text-right font-medium text-muted px-4 py-2.5">Paid</th>
                      <th className="text-right font-medium text-muted px-4 py-2.5">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5 text-ink font-medium">
                          {p.name} <span className="text-muted font-normal">({p.sheetNo})</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink">{formatMoney(p.budget ?? 0, currency)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink">{formatMoney(p.invoiced ?? 0, currency)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-moss">{formatMoney(p.paid ?? 0, currency)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-brick">
                          {formatMoney(p.outstanding ?? Math.max((p.budget ?? 0) - (p.paid ?? 0), 0), currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            margin: 15mm;
          }
          .print-section {
            break-inside: avoid;
          }
        }
      `}</style>
    </AppShell>
  );
}
