"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, AlertCircle } from "lucide-react";

type InvoiceDetail = {
  invoice: {
    id: string;
    amount: number;
    date: string;
    reference: string | null;
    note: string | null;
    createdAt: string;
  };
  project: {
    id: string;
    name: string;
    sheetNo: string;
    location: string;
    budget: number;
    invoiced: number;
  };
  client: {
    name: string;
    contactPerson: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  recordedBy: { name: string } | null;
  firm: { firmName: string; country: string; currency: string };
  sequenceNumber: number;
};

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load invoice");
        }
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load invoice");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-[13px]">
        Loading invoice…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <AlertCircle className="text-brick" size={28} />
        <p className="text-[13px] text-brick">{error ?? "Invoice not found"}</p>
        <button
          onClick={() => router.push("/finance")}
          className="text-[12.5px] text-blueprint hover:underline"
        >
          Back to Finance
        </button>
      </div>
    );
  }

  const { invoice, project, client, firm, sequenceNumber } = data;
  const invoiceNumber = `${project.sheetNo}-INV-${String(sequenceNumber).padStart(3, "0")}`;

  return (
    <div className="min-h-screen bg-vellum">
      {/* Toolbar -- hidden entirely on print via .no-print */}
      <div className="no-print sticky top-0 z-10 bg-surface border-b border-line px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-ink-solid text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink-solid/90"
        >
          <Printer size={15} />
          Print / Save as PDF
        </button>
      </div>

      {/* Printable document */}
      <div className="max-w-[210mm] mx-auto bg-surface my-8 print:my-0 print:max-w-none shadow-sm print:shadow-none print-page">
        <div className="p-12 print:p-10">
          {/* Letterhead */}
          <div className="flex items-start justify-between pb-8 border-b-2 border-ink-solid">
            <div>
              <h1 className="font-display text-[22px] font-bold text-ink tracking-tight">{firm.firmName}</h1>
              <p className="text-[12px] text-muted mt-0.5">{firm.country}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Invoice</p>
              <p className="text-[18px] font-mono font-semibold text-ink mt-0.5">{invoiceNumber}</p>
            </div>
          </div>

          {/* Bill to / meta */}
          <div className="flex justify-between mt-8 mb-10">
            <div>
              <p className="text-[10.5px] uppercase tracking-wide text-muted font-medium mb-1.5">Billed to</p>
              <p className="text-[14px] font-semibold text-ink">{client?.name ?? "—"}</p>
              {client?.contactPerson && <p className="text-[12.5px] text-muted mt-0.5">Attn: {client.contactPerson}</p>}
              {client?.address && <p className="text-[12.5px] text-muted mt-0.5 max-w-[220px]">{client.address}</p>}
              {client?.email && <p className="text-[12.5px] text-muted mt-0.5">{client.email}</p>}
              {client?.phone && <p className="text-[12.5px] text-muted mt-0.5">{client.phone}</p>}
            </div>
            <div className="text-right">
              <div className="mb-2">
                <p className="text-[10.5px] uppercase tracking-wide text-muted font-medium">Invoice date</p>
                <p className="text-[13px] text-ink font-medium">{formatDate(invoice.date)}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-wide text-muted font-medium">Project</p>
                <p className="text-[13px] text-ink font-medium">{project.name}</p>
                <p className="text-[11.5px] text-muted">{project.sheetNo} — {project.location}</p>
              </div>
            </div>
          </div>

          {/* Line item */}
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-line">
                <th className="text-left text-[10.5px] uppercase tracking-wide text-muted font-medium pb-2">Description</th>
                <th className="text-right text-[10.5px] uppercase tracking-wide text-muted font-medium pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-4 text-[13px] text-ink">
                  Professional services — {project.name}
                  {invoice.reference && (
                    <span className="block text-[11.5px] text-muted mt-0.5">Ref: {invoice.reference}</span>
                  )}
                  {invoice.note && <span className="block text-[11.5px] text-muted mt-0.5">{invoice.note}</span>}
                </td>
                <td className="py-4 text-[13px] text-ink text-right font-mono">
                  {formatMoney(invoice.amount, firm.currency)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Total */}
          <div className="flex justify-end mt-6">
            <div className="w-64">
              <div className="flex justify-between py-2 border-t-2 border-ink-solid">
                <span className="text-[13px] font-semibold text-ink">Total due</span>
                <span className="text-[16px] font-mono font-bold text-ink">
                  {formatMoney(invoice.amount, firm.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-6 border-t border-line flex justify-between text-[10.5px] text-muted">
            <span>Generated by {firm.firmName} — {formatDate(invoice.createdAt)}</span>
            {data.recordedBy?.name && <span>Recorded by {data.recordedBy.name}</span>}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            margin: 15mm;
          }
          .print-page {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
