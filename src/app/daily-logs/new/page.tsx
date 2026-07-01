"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { projects } from "@/data/mock";
import { AppShell } from "@/components/layout/app-shell";

export default function NewDailyLogPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(50);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/daily-logs");
  }

  return (
    <AppShell>
    <div className="max-w-2xl">
      <h1 className="font-display font-bold text-[19px] text-ink mb-0.5">Submit daily log</h1>
      <p className="text-muted text-[12px] mb-5">Required before close of business today.</p>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] text-muted block mb-1.5">Project</label>
            <select required className="w-full border border-line rounded-md px-3 py-2 text-[13px] bg-white">
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.sheetNo} — {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[12px] text-muted block mb-1.5">Work completed today</label>
            <textarea
              required
              rows={3}
              placeholder="Describe what was completed today…"
              className="w-full border border-line rounded-md px-3 py-2 text-[13px] resize-none bg-white"
            />
          </div>

          <div>
            <label className="text-[12px] text-muted block mb-1.5">Challenges encountered</label>
            <textarea
              rows={2}
              placeholder="Any blockers, delays, or issues to flag…"
              className="w-full border border-line rounded-md px-3 py-2 text-[13px] resize-none bg-white"
            />
          </div>

          <div>
            <label className="text-[12px] text-muted block mb-1.5">Pending work</label>
            <textarea
              rows={2}
              placeholder="What's still outstanding…"
              className="w-full border border-line rounded-md px-3 py-2 text-[13px] resize-none bg-white"
            />
          </div>

          <div>
            <label className="text-[12px] text-muted block mb-1.5">Next actions</label>
            <textarea
              rows={2}
              placeholder="What happens next…"
              className="w-full border border-line rounded-md px-3 py-2 text-[13px] resize-none bg-white"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[12px] text-muted">Overall project progress</label>
              <span className="font-mono text-[12px] text-blueprint">{progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-blueprint"
            />
          </div>

          <div>
            <label className="text-[12px] text-muted block mb-1.5">Attach files</label>
            <div className="border border-dashed border-line rounded-md p-5 text-center text-[12px] text-muted">
              Drag and drop drawings, photos, or documents — or click to browse.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-3.5 py-2 rounded-md text-[12.5px] border border-line text-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium"
            >
              Submit log
            </button>
          </div>
        </form>
      </Card>
    </div>
  </AppShell>
  );
}
