import { prisma } from "@/lib/prisma";
import { notifyDeadlineApproaching, notifyMissingDailyReport } from "@/lib/notifications";

/**
 * Fires only at these exact thresholds rather than every day a project is
 * "close" to due — otherwise an architect with a project due in 9 days
 * gets nine identical emails in a row before the deadline even matters.
 */
const DEADLINE_THRESHOLDS_DAYS = [7, 3, 1, 0];

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(from: Date, to: Date) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/**
 * Runs once a day. For every active (non-completed) project whose due date
 * lands on one of the fixed thresholds, notifies the assigned architect and
 * supervisor. Idempotent by construction: it's driven off the calendar
 * date, so re-running it the same day is a no-op in effect (recipients
 * just get the same email again, which is safe but not elegant — see
 * NOTIFICATIONS_INTEGRATION.md for the dedup upgrade path).
 */
export async function checkApproachingDeadlines() {
  const today = new Date();

  const candidates = await prisma.project.findMany({
    where: {
      status: { not: "COMPLETED" },
      dueDate: {
        gte: startOfDay(today),
        lte: new Date(startOfDay(today).getTime() + 8 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      name: true,
      dueDate: true,
      architectId: true,
      supervisorId: true,
    },
  });

  let notified = 0;

  for (const project of candidates) {
    const daysRemaining = daysBetween(today, project.dueDate);
    if (!DEADLINE_THRESHOLDS_DAYS.includes(daysRemaining)) continue;

    const recipients = [project.architectId, project.supervisorId].filter(
      (id): id is string => !!id
    );

    for (const userId of recipients) {
      await notifyDeadlineApproaching({
        userId,
        projectId: project.id,
        projectName: project.name,
        dueDate: project.dueDate,
        daysRemaining,
      });
      notified++;
    }
  }

  return { projectsChecked: candidates.length, notificationsSent: notified };
}

/**
 * Runs once on weekday evenings. For every active project, checks whether
 * the assigned architect submitted a DailyLog for today (matching the
 * DailyLog model's @@unique([projectId, authorId, date]) constraint) and
 * reminds them if not.
 */
export async function checkMissingDailyReports() {
  const today = startOfDay(new Date());

  const activeProjects = await prisma.project.findMany({
    where: {
      status: { not: "COMPLETED" },
      architectId: { not: null },
    },
    select: { id: true, name: true, architectId: true },
  });

  let notified = 0;

  for (const project of activeProjects) {
    if (!project.architectId) continue;

    const existingLog = await prisma.dailyLog.findUnique({
      where: {
        projectId_authorId_date: {
          projectId: project.id,
          authorId: project.architectId,
          date: today,
        },
      },
      select: { id: true },
    });

    if (existingLog) continue;

    await notifyMissingDailyReport({
      userId: project.architectId,
      projectId: project.id,
      projectName: project.name,
      date: today,
    });
    notified++;
  }

  return { projectsChecked: activeProjects.length, notificationsSent: notified };
}
