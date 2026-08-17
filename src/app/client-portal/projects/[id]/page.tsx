"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/form-field";
import { ArrowLeft, FileText, Download, Send, MessageSquare } from "lucide-react";

interface PortalDocument {
  id: string; name: string; category: string; fileUrl: string; fileSize: number; version: number; uploadedAt: string;
}
interface PortalComment {
  id: string; content: string; type: string; author: string; viaPortal: boolean; createdAt: string; resolvedAt: string | null;
}
interface PortalProjectDetail {
  id: string; sheetNo: string; name: string; description: string | null; location: string;
  status: "ON_TRACK" | "AT_RISK" | "DELAYED" | "COMPLETED"; progress: number;
  startDate: string; dueDate: string; completionDate: string | null;
  architect: { name: string } | null;
  documents: PortalDocument[];
  comments: PortalComment[];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientPortalProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<PortalProjectDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    const res = await fetch(`/api/client-portal/projects/${id}`);
    if (!res.ok) {
      setError(res.status === 404 ? "Project not found." : "Failed to load project.");
      return;
    }
    setProject(await res.json());
  }

  useEffect(() => {
    // Deferred to a microtask — see document-list.tsx for why calling load()
    // synchronously within the effect body trips react-hooks/set-state-in-effect.
    Promise.resolve().then(load);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/client-portal/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, content: message.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to send message");
      setMessage("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (error && !project) {
    return (
      <div>
        <Link href="/client-portal" className="inline-flex items-center gap-1.5 text-muted hover:text-ink text-[12.5px] mb-3"><ArrowLeft size={14} />Back</Link>
        <Card className="p-6 text-center text-brick text-[13px]">{error}</Card>
      </div>
    );
  }
  if (!project) return <p className="text-muted text-[13px]">Loading…</p>;

  return (
    <div>
      <Link href="/client-portal" className="inline-flex items-center gap-1.5 text-muted hover:text-ink text-[12.5px] mb-3"><ArrowLeft size={14} />Back to your projects</Link>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="font-mono text-[11.5px] text-muted">{project.sheetNo} · {project.location}</div>
          <h1 className="font-display font-bold text-[21px] text-ink mt-0.5">{project.name}</h1>
          {project.description && <p className="text-muted text-[12.5px] mt-1">{project.description}</p>}
        </div>
        <StatusPill status={project.status} className="px-2.5 py-1" />
      </div>

      <Card className="p-4 mb-3.5">
        <div className="w-full h-2.5 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-blueprint rounded-full" style={{ width: `${project.progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[12px] text-muted">
          <span className="font-medium text-ink">{project.progress}% complete</span>
          <span>Started {new Date(project.startDate).toLocaleDateString("en-KE", { dateStyle: "medium" })} · Due {new Date(project.dueDate).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
        </div>
        {project.architect && <div className="text-[12px] text-muted mt-2 pt-2 border-t border-line">Lead architect: <span className="text-ink">{project.architect.name}</span></div>}
      </Card>

      <Card className="p-4 mb-3.5">
        <div className="font-medium text-ink text-[13px] mb-3">Drawings & documents</div>
        {project.documents.length === 0 ? (
          <p className="text-muted text-[12.5px]">No documents shared yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {project.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-line first:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-muted shrink-0" />
                  <div className="min-w-0">
                    <div className="text-ink text-[12.5px] font-medium truncate">{doc.name}</div>
                    <div className="text-muted text-[10.5px] font-mono">v{doc.version} · {formatFileSize(doc.fileSize)} · {new Date(doc.uploadedAt).toLocaleDateString("en-KE")}</div>
                  </div>
                </div>
                <a href={doc.fileUrl} download={doc.name} className="text-blueprint shrink-0" title="Download"><Download size={15} /></a>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="font-medium text-ink text-[13px] mb-3 flex items-center gap-1.5"><MessageSquare size={14} />Messages</div>
        {project.comments.length === 0 ? (
          <p className="text-muted text-[12.5px] mb-3">No messages yet — send one below.</p>
        ) : (
          <div className="flex flex-col gap-2.5 mb-4 max-h-80 overflow-y-auto">
            {project.comments.map(c => (
              <div key={c.id} className={`border-t border-line pt-2.5 first:border-0 first:pt-0 ${c.resolvedAt ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-ink text-[12px] font-medium">{c.viaPortal ? "You" : c.author}</span>
                  <span className="text-[10px] text-muted">{new Date(c.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
                </div>
                <p className="text-[12.5px] text-ink leading-snug">{c.content}</p>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex flex-col gap-2">
          <Textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask a question or leave feedback for the team…" />
          {error && <p className="text-brick text-[11.5px]">{error}</p>}
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="self-end flex items-center gap-1.5 bg-brick text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-brick/90 disabled:opacity-50"
          >
            <Send size={14} />{sending ? "Sending…" : "Send"}
          </button>
        </form>
      </Card>
    </div>
  );
}
