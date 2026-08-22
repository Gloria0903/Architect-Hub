"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  useStore,
  formatKsh,
  commentTypeLabel,
} from "@/store/app-store";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export default function DashboardPage() {
  const {
    projects = [],
    staff = [],
    logs = [],
    comments = [],
    payments = [],
    notifications = [],
    markNotificationRead,
  } = useStore();

  const { data: session } = useSession();

  const isAdmin = session?.user?.role === "ADMIN";
  const isSeniorArchitect = session?.user?.role === "SENIOR_ARCHITECT";
  // Every hasFirmWideView branch below this point is about "firm-wide dashboard
  // view vs. personal view" -- not an admin-only action -- and senior
  // architects have the same firm-wide data access (see rbac.ts), so they
  // get the same view here too.
  const hasFirmWideView = isAdmin || isSeniorArchitect;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const dayKey = (value: string | Date) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().split("T")[0];
  };

  const safeNumber = (value: unknown, fallback = 0): number => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
  };

  const percentage = (part: number, total: number): number => {
    if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
      return 0;
    }

    const result = (part / total) * 100;

    if (!Number.isFinite(result)) {
      return 0;
    }

    return Math.min(100, Math.max(0, Math.round(result * 10) / 10));
  };

  // ---------------------------------------------------------------------------
  // Current date / logs
  // ---------------------------------------------------------------------------

  const now = new Date();
  const today = dayKey(now);

  const todayLogs = logs.filter(
    (log) => dayKey(log.date) === today
  );

  // ---------------------------------------------------------------------------
  // Project health
  // ---------------------------------------------------------------------------

  const delayed = projects.filter(
    (project) => project.status === "DELAYED"
  );

  const atRisk = projects.filter(
    (project) => project.status === "AT_RISK"
  );

  const onTrack = projects.filter(
    (project) => project.status === "ON_TRACK"
  );

  const projectCount = projects.length;

  /*
   * IMPORTANT:
   * These values are always finite numbers.
   * This prevents React/SVG from receiving NaN.
   */
  const onTrackPct = percentage(onTrack.length, projectCount);
  const atRiskPct = percentage(atRisk.length, projectCount);
  const delayedPct = percentage(delayed.length, projectCount);

  // ---------------------------------------------------------------------------
  // Notifications / comments
  // ---------------------------------------------------------------------------

  const unread = notifications.filter(
    (notification) => !notification.read
  );

  const unresolved = comments.filter(
    (comment) => !comment.resolvedAt
  );

  // ---------------------------------------------------------------------------
  // Finance
  // ---------------------------------------------------------------------------

  const totalContractValue = projects.reduce(
  (sum, project) =>
    sum + safeNumber(project.budget),
  0
);

const totalRevenue = projects.reduce(
  (sum, project) =>
    sum + safeNumber(project.paid),
  0
);

const totalOutstanding = Math.max(
  totalContractValue - totalRevenue,
  0
);

  // ---------------------------------------------------------------------------
  // Missing daily submissions
  // ---------------------------------------------------------------------------

  // Daily logs are hands-on site reporting -- only ARCHITECT does that.
  // ADMIN and SENIOR_ARCHITECT are oversight roles and aren't expected to
  // submit one, same reasoning as the ADMIN exclusion that was already here.
  const loggingStaffCount = staff.filter(
    (member) => member.role === "ARCHITECT"
  ).length;

  const missingSubmissions = hasFirmWideView
    ? Math.max(0, loggingStaffCount - todayLogs.length)
    : 0;

  // ---------------------------------------------------------------------------
  // Weekly logs
  // ---------------------------------------------------------------------------

  const mondayOffset = (now.getDay() + 6) % 7;

  const startOfWeek = new Date(now);

  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(
    now.getDate() - mondayOffset
  );

  const weekDayKeys = Array.from(
    { length: 7 },
    (_, index) => {
      const date = new Date(startOfWeek);

      date.setDate(
        startOfWeek.getDate() + index
      );

      return dayKey(date);
    }
  );

  const weeklyLogs = weekDayKeys.map(
    (key) =>
      logs.filter(
        (log) => dayKey(log.date) === key
      ).length
  );

  const maxWeeklyLogs = Math.max(
    ...weeklyLogs,
    1
  );

  const todayIndex = mondayOffset;

  // ---------------------------------------------------------------------------
  // Revenue trend
  // ---------------------------------------------------------------------------

  const monthLabel = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}`;

  const monthBuckets = Array.from(
    { length: 6 },
    (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - (5 - index),
        1
      );

      return {
        key: monthLabel(date),
        total: 0,
      };
    }
  );

  payments.forEach((payment) => {
    const paymentDate = new Date(payment.date);

    if (Number.isNaN(paymentDate.getTime())) {
      return;
    }

    const key = monthLabel(paymentDate);

    const bucket = monthBuckets.find(
      (item) => item.key === key
    );

    if (bucket) {
      bucket.total += safeNumber(payment.amount);
    }
  });

  const maxMonthTotal = Math.max(
    ...monthBuckets.map((bucket) =>
      safeNumber(bucket.total)
    ),
    1
  );

  const trendPoints = monthBuckets.map(
    (bucket, index) => ({
      x:
        4 +
        index *
          (200 / (monthBuckets.length - 1)),
      y:
        64 -
        (safeNumber(bucket.total) /
          maxMonthTotal) *
          52,
    })
  );

  const trendPolyline = trendPoints
    .map(
      (point) =>
        `${point.x},${point.y}`
    )
    .join(" ");

  const trendArea =
    trendPoints.length > 0
      ? `${trendPolyline} ${
          trendPoints[
            trendPoints.length - 1
          ].x
        },68 ${trendPoints[0].x},68`
      : "";

  const lastMonthTotal =
    monthBuckets[
      monthBuckets.length - 1
    ]?.total ?? 0;

  const prevMonthTotal =
    monthBuckets[
      monthBuckets.length - 2
    ]?.total ?? 0;

  const revenueChangePct =
    prevMonthTotal > 0
      ? Math.round(
          ((lastMonthTotal -
            prevMonthTotal) /
            prevMonthTotal) *
            1000
        ) / 10
      : lastMonthTotal > 0
        ? 100
        : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell>
      <div>
        {/* ----------------------------------------------------------------- */}
        {/* Header */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">
              {hasFirmWideView
                ? "Admin Dashboard"
                : "My Dashboard"}
            </h1>

            <p className="text-muted text-[12px] mt-0.5">
              {now.toLocaleDateString(
                "en-KE",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}{" "}
              — {projects.length}{" "}
              {hasFirmWideView
                ? `active projects across ${loggingStaffCount} staff`
                : "projects assigned to you"}
            </p>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* KPI ROW */}
        {/* ----------------------------------------------------------------- */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
          {/* Active projects */}

          <Card className="p-3.5">
            <div className="text-muted text-[11px]">
              Active projects
            </div>

            <div className="font-display font-bold text-[28px] text-ink mt-0.5">
              {projects.length}
            </div>

            <div className="text-moss text-[11px] mt-1">
              ↑ {onTrack.length} on track
            </div>
          </Card>

          {/* Revenue / comments */}

          {hasFirmWideView ? (
            <Card className="p-3.5">
              <div className="text-muted text-[11px]">
                Total revenue
              </div>

              <div className="font-mono font-medium text-[17px] text-ink mt-1">
                {formatKsh(totalRevenue)}
              </div>

              <div className="text-muted text-[11px] mt-1.5">
                Outstanding:{" "}
                {formatKsh(totalOutstanding)}
              </div>
            </Card>
          ) : (
            <Card className="p-3.5">
              <div className="text-muted text-[11px]">
                Unresolved client comments
              </div>

              <div className="font-display font-bold text-[28px] text-ochre mt-0.5">
                {unresolved.length}
              </div>

              <div className="text-muted text-[11px] mt-1">
                {delayed.length} delayed
              </div>
            </Card>
          )}

          {/* Daily logs */}

          <Card className="p-3.5">
            <div className="text-muted text-[11px]">
              {hasFirmWideView
                ? "Logs today"
                : "Your logs today"}
            </div>

            <div className="font-display font-bold text-[28px] text-ink mt-0.5">
              {todayLogs.length}
            </div>

            {hasFirmWideView ? (
              <div className="text-brick text-[11px] mt-1">
                {missingSubmissions} missing submissions
              </div>
            ) : (
              <div className="text-muted text-[11px] mt-1">
                Across your projects
              </div>
            )}
          </Card>

          {/* Admin comments */}

          {hasFirmWideView && (
            <Card className="p-3.5">
              <div className="text-muted text-[11px]">
                Unresolved client comments
              </div>

              <div className="font-display font-bold text-[28px] text-ochre mt-0.5">
                {unresolved.length}
              </div>

              <div className="text-muted text-[11px] mt-1">
                {delayed.length} delayed projects
              </div>
            </Card>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* CHARTS ROW */}
        {/* ----------------------------------------------------------------- */}

        <div
          className={`grid grid-cols-1 gap-3 mb-3.5 ${
            hasFirmWideView
              ? "lg:grid-cols-3"
              : "lg:grid-cols-2"
          }`}
        >
          {/* Project health */}

          <Card className="p-3.5">
            <div className="font-medium text-ink text-[12.5px] mb-3">
              Project health
            </div>

            <div className="flex items-center gap-4">
              <svg
                width="90"
                height="90"
                viewBox="0 0 36 36"
                aria-hidden="true"
              >
                {/* Background ring */}

                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#E6E9EA"
                  strokeWidth="5"
                  pathLength="100"
                />

                {/* On track */}

                {onTrackPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#2F7A5E"
                    strokeWidth="5"
                    strokeDasharray={`${onTrackPct} 100`}
                    strokeDashoffset="0"
                    strokeLinecap="butt"
                    pathLength="100"
                    transform="rotate(-90 18 18)"
                  />
                )}

                {/* At risk */}

                {atRiskPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#B07F1F"
                    strokeWidth="5"
                    strokeDasharray={`${atRiskPct} 100`}
                    strokeDashoffset={-onTrackPct}
                    strokeLinecap="butt"
                    pathLength="100"
                    transform="rotate(-90 18 18)"
                  />
                )}

                {/* Delayed */}

                {delayedPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#B5502E"
                    strokeWidth="5"
                    strokeDasharray={`${delayedPct} 100`}
                    strokeDashoffset={
                      -(onTrackPct + atRiskPct)
                    }
                    strokeLinecap="butt"
                    pathLength="100"
                    transform="rotate(-90 18 18)"
                  />
                )}
              </svg>

              <div className="flex flex-col gap-2 text-[11.5px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-moss inline-block" />

                  <span className="text-ink font-medium">
                    {onTrack.length}
                  </span>

                  <span className="text-muted">
                    On track
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-ochre inline-block" />

                  <span className="text-ink font-medium">
                    {atRisk.length}
                  </span>

                  <span className="text-muted">
                    At risk
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-brick inline-block" />

                  <span className="text-ink font-medium">
                    {delayed.length}
                  </span>

                  <span className="text-muted">
                    Delayed
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Weekly logs */}

          <Card className="p-3.5">
            <div className="font-medium text-ink text-[12.5px] mb-2">
              {hasFirmWideView
                ? "Daily logs this week"
                : "Your daily logs this week"}
            </div>

            <svg
              width="100%"
              height="70"
              viewBox="0 0 160 70"
              aria-hidden="true"
            >
              {weeklyLogs.map(
                (value, index) => {
                  const numericValue =
                    safeNumber(value);

                  const height =
                    numericValue === 0
                      ? 2
                      : Math.min(
                          56,
                          (numericValue /
                            maxWeeklyLogs) *
                            56
                        );

                  return (
                    <rect
                      key={index}
                      x={6 + index * 22}
                      y={64 - height}
                      width="14"
                      height={height}
                      fill={
                        index === todayIndex
                          ? "#2451C4"
                          : numericValue === 0
                            ? "#E6E9EA"
                            : "#B5D4F4"
                      }
                      rx="2"
                    />
                  );
                }
              )}
            </svg>

            <div className="flex justify-between text-[9.5px] text-muted font-mono px-1">
              {[
                "M",
                "T",
                "W",
                "T",
                "F",
                "S",
                "S",
              ].map((day, index) => (
                <span key={index}>
                  {day}
                </span>
              ))}
            </div>
          </Card>

          {/* Revenue trend */}

          {hasFirmWideView && (
            <Card className="p-3.5">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium text-ink text-[12.5px]">
                  Revenue trend
                </div>

                <div
                  className={`text-[11px] ${
                    revenueChangePct >= 0
                      ? "text-moss"
                      : "text-brick"
                  }`}
                >
                  {revenueChangePct >= 0
                    ? "+"
                    : ""}
                  {revenueChangePct}%
                </div>
              </div>

              <svg
                width="100%"
                height="68"
                viewBox="0 0 220 68"
                aria-hidden="true"
              >
                <polyline
                  points={trendPolyline}
                  fill="none"
                  stroke="#2451C4"
                  strokeWidth="2"
                />

                <polyline
                  points={trendArea}
                  fill="#E7EDFA"
                  stroke="none"
                />

                {trendPoints.map(
                  (point, index) => (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={point.y}
                      r="2.5"
                      fill="#2451C4"
                    />
                  )
                )}
              </svg>
            </Card>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* PROJECTS + NOTIFICATIONS */}
        {/* ----------------------------------------------------------------- */}

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3 mb-3.5">
          {/* Projects */}

          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">
                {hasFirmWideView
                  ? "All projects"
                  : "My projects"}
              </div>

              <Link
                href="/projects"
                className="text-blueprint text-[11px] font-mono"
              >
                Manage →
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted text-[12px]">
                  No projects available.
                </p>

                {hasFirmWideView && (
                  <Link
                    href="/projects"
                    className="inline-block mt-2 text-blueprint text-[11px]"
                  >
                    Create your first project →
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11.5px]">
                  <thead>
                    <tr className="text-muted text-left">
                      <th className="font-medium pb-2">
                        Sheet
                      </th>

                      <th className="font-medium pb-2">
                        Project
                      </th>

                      <th className="font-medium pb-2">
                        Architect
                      </th>

                      <th className="font-medium pb-2 text-right">
                        Progress
                      </th>

                      <th className="font-medium pb-2">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {projects.map(
                      (project) => {
                        const architect =
                          staff.find(
                            (member) =>
                              member.id ===
                              project.architectId
                          );

                        const progress = Math.min(
                          100,
                          Math.max(
                            0,
                            safeNumber(
                              project.progress
                            )
                          )
                        );

                        return (
                          <tr
                            key={project.id}
                            className="border-t border-line hover:bg-vellum/50"
                          >
                            <td className="py-2 font-mono text-muted text-[11px]">
                              {
                                project.sheetNo
                              }
                            </td>

                            <td className="py-2 text-ink font-medium">
                              <Link
                                href={`/projects/${project.id}`}
                                className="hover:text-blueprint"
                              >
                                {project.name}
                              </Link>
                            </td>

                            <td className="py-2 text-muted">
                              {architect ? (
                                architect.name
                              ) : (
                                <span className="text-brick">
                                  Unassigned
                                </span>
                              )}
                            </td>

                            <td className="py-2 font-mono text-right">
                              {progress}%
                            </td>

                            <td className="py-2">
                              <StatusPill
                                status={
                                  project.status
                                }
                              />
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Notifications */}

          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">
                Notifications
              </div>

              {unread.length > 0 && (
                <span className="text-[11px] text-muted">
                  {unread.length} unread
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {notifications.length === 0 ? (
                <p className="text-muted text-[12px]">
                  No notifications.
                </p>
              ) : (
                notifications
                  .slice(0, 6)
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex gap-2.5 p-2.5 rounded-md cursor-pointer transition-colors ${
                        notification.read
                          ? "bg-transparent"
                          : "bg-vellum"
                      }`}
                      onClick={() =>
                        markNotificationRead(
                          notification.id
                        )
                      }
                    >
                      {notification.type ===
                        "ERROR" && (
                        <AlertTriangle
                          size={14}
                          className="text-brick mt-0.5 shrink-0"
                        />
                      )}

                      {notification.type ===
                        "WARNING" && (
                        <AlertTriangle
                          size={14}
                          className="text-ochre mt-0.5 shrink-0"
                        />
                      )}

                      {notification.type ===
                        "SUCCESS" && (
                        <CheckCircle
                          size={14}
                          className="text-moss mt-0.5 shrink-0"
                        />
                      )}

                      {notification.type ===
                        "INFO" && (
                        <Bell
                          size={14}
                          className="text-blueprint mt-0.5 shrink-0"
                        />
                      )}

                      <div>
                        <p
                          className={`text-[11.5px] leading-snug ${
                            notification.read
                              ? "text-muted"
                              : "text-ink"
                          }`}
                        >
                          {
                            notification.message
                          }
                        </p>

                        {!notification.read && (
                          <span className="text-[10px] text-blueprint">
                            Click to mark read
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* TODAY'S LOGS + CLIENT COMMENTS */}
        {/* ----------------------------------------------------------------- */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Today's logs */}

          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">
                Today&apos;s submitted logs
              </div>

              <Link
                href="/daily-logs"
                className="text-blueprint text-[11px] font-mono"
              >
                View all →
              </Link>
            </div>

            {todayLogs.length === 0 ? (
              <p className="text-muted text-[12px]">
                No logs submitted yet today.
              </p>
            ) : (
              todayLogs.map((log) => {
                const author = staff.find(
                  (member) =>
                    member.id ===
                    log.authorId
                );

                const project = projects.find(
                  (item) =>
                    item.id ===
                    log.projectId
                );

                return (
                  <div
                    key={log.id}
                    className="border-t border-line pt-2.5 mt-2.5 first:border-0 first:mt-0 first:pt-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar
                        avatarUrl={
                          author?.avatarUrl
                        }
                        initials={
                          author?.initials
                        }
                        name={author?.name}
                        size={20}
                        fontSize={9}
                      />

                      <span className="text-ink text-[12px] font-medium">
                        {author?.name ??
                          "Unknown user"}
                      </span>

                      <span className="text-muted text-[11px]">
                        —{" "}
                        {project?.name ??
                          "Unknown project"}
                      </span>
                    </div>

                    <p className="text-[11.5px] text-muted leading-snug line-clamp-2">
                      {log.workCompleted}
                    </p>
                  </div>
                );
              })
            )}
          </Card>

          {/* Client comments */}

          <Card className="p-3.5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-medium text-ink text-[12.5px]">
                Recent client comments
              </div>

              <Link
                href="/client-comms"
                className="text-blueprint text-[11px] font-mono"
              >
                View all →
              </Link>
            </div>

            {comments.length === 0 ? (
              <p className="text-muted text-[12px]">
                No client comments yet.
              </p>
            ) : (
              comments
                .slice(0, 3)
                .map((comment) => {
                  const project =
                    projects.find(
                      (item) =>
                        item.id ===
                        comment.projectId
                    );

                  return (
                    <div
                      key={comment.id}
                      className="border-t border-line pt-2.5 mt-2.5 first:border-0 first:mt-0 first:pt-0"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-ink text-[12px] font-medium">
                          {comment.author}
                        </span>

                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            comment.type ===
                            "CHANGE_REQUEST"
                              ? "bg-brick-bg text-brick"
                              : comment.type ===
                                  "APPROVAL"
                                ? "bg-moss-bg text-moss"
                                : "bg-blueprint-bg text-blueprint"
                          }`}
                        >
                          {commentTypeLabel(
                            comment.type
                          )}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted">
                        {project?.name ??
                          "Unknown project"}
                      </p>

                      <p className="text-[11.5px] text-ink mt-0.5 leading-snug line-clamp-2">
                        {comment.content}
                      </p>
                    </div>
                  );
                })
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}