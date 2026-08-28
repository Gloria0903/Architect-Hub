"use client";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea, Field } from "@/components/ui/form-field";
import { useStore, commentTypeLabel, CommentType } from "@/store/app-store";
import { CheckCircle, MessageCircle, Filter } from "lucide-react";

const typeColors: Record<CommentType, string> = {
  CHANGE_REQUEST: "bg-brick-bg text-brick",
  APPROVAL: "bg-moss-bg text-moss",
  QUERY: "bg-blueprint-bg text-blueprint",
  FEEDBACK: "bg-ochre-bg text-ochre",
};

export default function ClientCommsPage() {
  const { comments, projects, clients, addComment, resolveComment } = useStore();
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ projectId: "", clientId: "", author: "", content: "", type: "FEEDBACK" as CommentType });

  const visible = comments
    .filter(c => filterProject === "all" || c.projectId === filterProject)
    .filter(c => filterType === "all" || c.type === filterType)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const client = clients.find(c => c.id === form.clientId);
    addComment({ ...form, author: form.author || client?.contactPerson || "Client" });
    setAddOpen(false);
    setForm({ projectId: "", clientId: "", author: "", content: "", type: "FEEDBACK" });
  }

  return (
    <AppShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">Client communications</h1>
            <p className="text-muted text-[12px] mt-0.5">{comments.filter(c=>!c.resolvedAt).length} unresolved · {comments.length} total</p>
          </div>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 bg-ink-solid text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink-solid/90">
            <MessageCircle size={15} />Log comment
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter size={14} className="text-muted" />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none">
            <option value="all">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-line rounded-md px-2.5 py-1.5 text-[12px] bg-surface outline-none">
            <option value="all">All types</option>
            <option value="CHANGE_REQUEST">Change requests</option>
            <option value="APPROVAL">Approvals</option>
            <option value="QUERY">Queries</option>
            <option value="FEEDBACK">Feedback</option>
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-muted cursor-pointer ml-auto">
            <input type="checkbox" onChange={e => setFilterType(e.target.checked ? "__unresolved__" : "all")} className="accent-blueprint" />
            Unresolved only
          </label>
        </div>

        <div className="flex flex-col gap-3">
          {visible.length === 0 && (
            <Card className="p-8 text-center text-muted text-[12.5px]">No comments match your filters.</Card>
          )}
          {visible.map(comment => {
            const project = projects.find(p => p.id === comment.projectId);
            const isResolved = !!comment.resolvedAt;
            return (
              <Card key={comment.id} className={`p-4 transition-opacity ${isResolved ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <div className="w-6 h-6 rounded-full bg-ochre-bg text-ochre text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {comment.author.split(" ").map(w=>w[0]).join("").slice(0,2)}
                      </div>
                      <span className="text-ink font-medium text-[13px]">{comment.author}</span>
                      <span className="text-muted text-[11.5px]">on</span>
                      <span className="text-ink text-[11.5px] font-mono">{project?.sheetNo}</span>
                      <span className="text-muted text-[11.5px]">— {project?.name}</span>
                      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-[3px] font-medium ${typeColors[comment.type]}`}>
                        {commentTypeLabel(comment.type)}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-ink leading-relaxed">{comment.content}</p>
                    <div className="text-[11px] text-muted mt-2 font-mono">
                      {new Date(comment.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                      {isResolved && <span className="ml-3 text-moss">✓ Resolved</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!isResolved && (
                      <button onClick={() => resolveComment(comment.id)} className="flex items-center gap-1 text-[11px] text-moss border border-moss/30 rounded px-2 py-1 hover:bg-moss-bg transition-colors">
                        <CheckCircle size={12} />Resolve
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Log comment modal */}
        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log client comment" subtitle="Record a comment, change request, approval, or query from a client">
          <form onSubmit={handleAdd} className="flex flex-col gap-3.5">
            <Field label="Project" required>
              <Select required value={form.projectId} onChange={e => { const p = projects.find(pr=>pr.id===e.target.value); setForm(f=>({...f,projectId:e.target.value,clientId:p?.clientId||""})); }}>
                <option value="">Select project</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>)}
              </Select>
            </Field>
            <Field label="Comment type" required>
              <Select required value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value as typeof form.type}))}>
                <option value="FEEDBACK">Feedback</option>
                <option value="CHANGE_REQUEST">Change request</option>
                <option value="APPROVAL">Approval</option>
                <option value="QUERY">Query</option>
              </Select>
            </Field>
            <Field label="Client / author name">
              <input className="w-full border border-line rounded-md px-3 py-2 text-[13px] bg-surface text-ink outline-none focus:border-blueprint" value={form.author} onChange={e => setForm(f=>({...f,author:e.target.value}))} placeholder="e.g. James Mwangi" />
            </Field>
            <Field label="Comment" required>
              <Textarea required rows={4} value={form.content} onChange={e => setForm(f=>({...f,content:e.target.value}))} placeholder="Enter the client's comment, instruction, or feedback…" />
            </Field>
            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink-solid text-white font-medium">Log comment</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
