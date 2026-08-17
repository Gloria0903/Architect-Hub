"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { ArrowRight, Calendar } from "lucide-react";

interface PortalProject {
  id: string;
  sheetNo: string;
  name: string;
  location: string;
  status: "ON_TRACK" | "AT_RISK" | "DELAYED" | "COMPLETED";
  progress: number;
  startDate: string;
  dueDate: string;
  completionDate: string | null;
  architect: { name: string; initials: string; avatarUrl: string | null } | null;
}

export default function ClientPortalHome() {
  const [projects, setProjects] = useState<PortalProject[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/client-portal/projects")
      .then(res => (res.ok ? res.json() : Promise.reject(new Error("Failed to load projects"))))
      .then(setProjects)
      .catch(err => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="font-display font-bold text-[20px] text-ink mb-1">Your projects</h1>
      <p className="text-muted text-[12.5px] mb-5">Live progress, drawings, and updates for everything we&apos;re working on together.</p>

      {error && <p className="text-brick text-[13px]">{error}</p>}

      {!projects && !error && <p className="text-muted text-[13px]">Loading…</p>}

      {projects && projects.length === 0 && (
        <Card className="p-6 text-center text-muted text-[13px]">No projects yet.</Card>
      )}

      <div className="flex flex-col gap-3">
        {projects?.map(p => (
          <Link key={p.id} href={`/client-portal/projects/${p.id}`}>
            <Card className="p-4 hover:border-blueprint transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] text-muted">{p.sheetNo} · {p.location}</div>
                  <div className="font-display font-semibold text-[15px] text-ink mt-0.5">{p.name}</div>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div className="mt-3">
                <div className="w-full h-2 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-blueprint rounded-full" style={{ width: `${p.progress}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11.5px] text-muted">
                  <span>{p.progress}% complete</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />Due {new Date(p.dueDate).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                {p.architect ? (
                  <div className="flex items-center gap-2 text-[12px] text-ink">
                    <Avatar avatarUrl={p.architect.avatarUrl} initials={p.architect.initials} name={p.architect.name} size={20} fontSize={9} />
                    {p.architect.name}
                  </div>
                ) : <span />}
                <span className="text-blueprint text-[12px] font-medium flex items-center gap-1">View details<ArrowRight size={13} /></span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
