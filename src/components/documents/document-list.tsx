"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, History, Trash2, Download, UploadCloud, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DocumentUploader } from "./document-uploader";

type DocumentCategory =
  | "DRAWING"
  | "BOQ"
  | "CONTRACT"
  | "SITE_REPORT"
  | "PRESENTATION"
  | "OTHER";

interface DocumentRow {
  id: string;
  name: string;
  category: DocumentCategory;
  fileSize: number;
  mimeType: string;
  version: number;
  versionCount: number;
  uploadedAt: string;
  previewUrl: string;
  uploadedBy: { id: string; name: string; initials: string };
}

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  DRAWING: "Drawing",
  BOQ: "BOQ",
  CONTRACT: "Contract",
  SITE_REPORT: "Site Report",
  PRESENTATION: "Presentation",
  OTHER: "Other",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<DocumentRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (category !== "ALL") qs.set("category", category);
    if (search) qs.set("q", search);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents?${qs.toString()}`);
      if (!res.ok) throw new Error("Could not load documents");
      const data = await res.json();
      setDocuments(data.documents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, [projectId, category, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(doc: DocumentRow) {
    if (!confirm(`Remove "${doc.name}"? This can be recovered by an admin if needed.`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) {
      setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Could not delete" }));
      setError(msg);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload documents</DialogTitle>
            </DialogHeader>
            <UploadCategoryPicker
              projectId={projectId}
              onComplete={() => {
                load();
              }}
              onError={setError}
            />
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading documents...</p>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No documents yet. Upload drawings, BOQs, contracts, or reports to keep this project's
          knowledge in one place.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <a
                    href={doc.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium hover:underline"
                  >
                    {doc.name}
                  </a>
                  <Badge variant="secondary">{CATEGORY_LABEL[doc.category]}</Badge>
                  {doc.versionCount > 1 && (
                    <Badge variant="outline">v{doc.version}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(doc.fileSize)} · Uploaded by {doc.uploadedBy.name} ·{" "}
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" title="Download" asChild>
                  <a href={doc.previewUrl} download={doc.name}>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Version history"
                  onClick={() => setVersionTarget(doc)}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remove"
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!versionTarget} onOpenChange={(open) => !open && setVersionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version history — {versionTarget?.name}</DialogTitle>
          </DialogHeader>
          {versionTarget && (
            <VersionHistory
              document={versionTarget}
              onUploaded={() => {
                setVersionTarget(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Lets the user pick a category before uploading one or more new documents. */
function UploadCategoryPicker({
  projectId,
  onComplete,
  onError,
}: {
  projectId: string;
  onComplete: () => void;
  onError: (msg: string) => void;
}) {
  const [category, setCategory] = useState<string>("OTHER");
  return (
    <div className="space-y-3">
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DocumentUploader
        target={{ mode: "new", projectId, category }}
        onComplete={onComplete}
        onError={onError}
      />
    </div>
  );
}

interface VersionRow {
  id: string;
  version: number;
  fileSize: number;
  uploadedAt: string;
  previewUrl?: string;
  uploadedBy: { name: string };
}

function VersionHistory({
  document,
  onUploaded,
}: {
  document: DocumentRow;
  onUploaded: () => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${document.id}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .finally(() => setLoading(false));
  }, [document.id]);

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading history...</p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <span className="font-medium">v{v.version}</span>{" "}
                <span className="text-muted-foreground">
                  · {formatBytes(v.fileSize)} · {v.uploadedBy.name} ·{" "}
                  {new Date(v.uploadedAt).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showUploader ? (
        <DocumentUploader
          target={{ mode: "version", documentId: document.id }}
          onComplete={onUploaded}
          onError={() => undefined}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowUploader(true)}>
          Upload new version
        </Button>
      )}
    </div>
  );
}
