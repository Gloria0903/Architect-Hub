import type { ProjectStatus } from "@/components/ui/status-pill";

const colorMap: Record<ProjectStatus, string> = {
  on_track: "#2F7A5E",
  at_risk: "#B07F1F",
  delayed: "#B5502E",
};

export function DimensionBar({
  progress,
  status,
}: {
  progress: number;
  status: ProjectStatus;
}) {
  const color = colorMap[status];
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <svg
      width="100%"
      height="22"
      viewBox="0 0 200 22"
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
    >
      <line x1="0" y1="11" x2="200" y2="11" stroke="#DEE3E5" strokeWidth="1" />
      <line x1="0" y1="6" x2="0" y2="16" stroke="#6B7680" strokeWidth="1" />
      <line
        x1={pct * 2}
        y1="6"
        x2={pct * 2}
        y2="16"
        stroke={color}
        strokeWidth="1.5"
      />
      <text
        x={Math.min(Math.max(pct * 2, 14), 186)}
        y="5"
        fontFamily="var(--font-plex-mono)"
        fontSize="9"
        fill={color}
        textAnchor="middle"
      >
        {pct}%
      </text>
    </svg>
  );
}
