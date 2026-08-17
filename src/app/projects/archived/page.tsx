"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArchiveRestore } from "lucide-react";

interface ArchivedProject {
  id: string;
  sheetNo: string;
  name: string;
  location: string;
  archivedAt: string;
  client?: { name: string };
}

/**
 * DELETE /api/projects/[id] soft-deletes (sets archivedAt) rather than
 * removing data — see that route. Without this page, an archived project
 * would be permanently invisible in the UI with no way back short of a
 * direct database edit, since PATCH refuses to touch archived projects.
 */
export default function ArchivedProjectsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [projects, setProjects] = useState<ArchivedProject[] | null>(null);
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/projects?archived=true");
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load archived projects");
      setProjects(await res.json());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    if (isAdmin) Promise.resolve().then(load);
  }, [isAdmin]);

  async function handleUnarchive(id: string, name: string) {
    if (!confirm(`Restore "${name}" to the active projects list?`)) return;
    setRestoringId(id);
    try {
      const res = await fetch(`/api/projects/${id}/unarchive`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to restore project");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <AppShell>
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-muted hover:text-ink text-[12.5px] mb-3">
          <ArrowLeft size={14} />Back to projects
        </Link>
        <h1 className="font-display font-bold text-[20px] text-ink mb-1">Archived projects</h1>
        <p className="text-muted text-[12px] mb-5">Data is kept, not deleted — restore a project to bring it back to the active list.</p>

        {!isAdmin && <Card className="p-6 text-center text-muted text-[12.5px]">Only an admin can view archived projects.</Card>}

        {isAdmin && error && <p className="text-brick text-[13px] mb-3">{error}</p>}
        {isAdmin && !projects && !error && <p className="text-muted text-[13px]">Loading…</p>}
        {isAdmin && projects?.length === 0 && (
          <Card className="p-6 text-center text-muted text-[12.5px]">No archived projects.</Card>
        )}

        {isAdmin && projects && projects.length > 0 && (
          <Card className="divide-y divide-line overflow-hidden">
            {projects.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-muted">{p.sheetNo}{p.client ? ` · ${p.client.name}` : ""}</div>
                  <div className="text-ink font-medium text-[13px] truncate">{p.name}</div>
                  <div className="text-muted text-[11px] mt-0.5">Archived {new Date(p.archivedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</div>
                </div>
                <button
                  disabled={restoringId === p.id}
                  onClick={() => handleUnarchive(p.id, p.name)}
                  className="flex items-center gap-1.5 border border-line text-blueprint rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-blueprint-bg disabled:opacity-50 shrink-0"
                >
                  <ArchiveRestore size={14} />{restoringId === p.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
