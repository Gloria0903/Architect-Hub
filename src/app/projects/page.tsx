"use client";

import { useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { DimensionBar } from "@/components/ui/dimension-bar";
import { projects, ProjectStatus } from "@/data/mock";
import { Plus, Repeat } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const filters: { label: string; value: ProjectStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "On track", value: "on_track" },
  { label: "At risk", value: "at_risk" },
  { label: "Delayed", value: "delayed" },
];

export default function ProjectsPage() {
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const visible = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <AppShell>
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-[19px] text-ink">Projects</h1>
          <p className="text-muted text-[12px] mt-0.5">{projects.length} projects across the firm</p>
        </div>
        <button className="flex items-center gap-1.5 bg-ink text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium">
          <Plus size={15} />
          New project
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-[12px] border ${
              filter === f.value
                ? "bg-ink text-white border-ink"
                : "bg-surface text-muted border-line"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map((p) => (
          <Card key={p.id} className="p-4 border-t-[3px]" style={{
            borderTopColor: p.status === "on_track" ? "#2F7A5E" : p.status === "at_risk" ? "#B07F1F" : "#B5502E"
          }}>
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="font-mono text-[11px] text-muted">{p.sheetNo}</div>
                <Link href={`/projects/${p.id}`}>
                  <div className="font-display font-semibold text-[15px] text-ink mt-0.5">{p.name}</div>
                </Link>
              </div>
              <StatusPill status={p.status} />
            </div>
            <div className="text-[11.5px] text-muted mt-1">{p.client} · {p.location}</div>
            <div className="mt-3.5">
              <DimensionBar progress={p.progress} status={p.status} />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blueprint-bg text-blueprint flex items-center justify-center text-[10px] font-semibold">
                  {p.architectInitials}
                </div>
                <span className="text-[11.5px] text-muted">{p.architect}</span>
              </div>
              {p.architect === "Unassigned" && (
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-1 text-[11px] text-brick font-medium"
                >
                  <Repeat size={12} />
                  Take over
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  </AppShell>
  );
}
