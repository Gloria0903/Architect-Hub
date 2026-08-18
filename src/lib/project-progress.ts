import { TaskStatus, MilestoneStatus } from "@prisma/client";

interface ProgressTask {
  weight: number;
  completion: number;
  status: TaskStatus;
}

interface ProgressMilestone {
  weight: number;
  status: MilestoneStatus;
}

export function calculateTaskProgress(tasks: ProgressTask[]) {
  if (!tasks.length) return 0;

  const totalWeight = tasks.reduce(
    (sum, task) => sum + Math.max(task.weight, 0),
    0
  );

  if (totalWeight === 0) return 0;

  const weightedCompletion = tasks.reduce(
    (sum, task) =>
      sum +
      Math.max(0, Math.min(100, task.completion)) *
        Math.max(task.weight, 0),
    0
  );

  return Math.round(weightedCompletion / totalWeight);
}

export function calculateMilestoneProgress(
  milestones: ProgressMilestone[]
) {
  if (!milestones.length) return 0;

  const totalWeight = milestones.reduce(
    (sum, milestone) => sum + Math.max(milestone.weight, 0),
    0
  );

  if (totalWeight === 0) return 0;

  const completedWeight = milestones.reduce(
    (sum, milestone) => {
      const completed =
        milestone.status === MilestoneStatus.COMPLETED ||
        milestone.status === MilestoneStatus.APPROVED;

      return sum + (completed ? Math.max(milestone.weight, 0) : 0);
    },
    0
  );

  return Math.round((completedWeight / totalWeight) * 100);
}

export function calculateProjectProgress({
  tasks,
  milestones,
}: {
  tasks: ProgressTask[];
  milestones: ProgressMilestone[];
}) {
  const taskProgress = calculateTaskProgress(tasks);
  const milestoneProgress = calculateMilestoneProgress(milestones);

  if (!tasks.length && !milestones.length) {
    return 0;
  }

  if (!tasks.length) {
    return milestoneProgress;
  }

  if (!milestones.length) {
    return taskProgress;
  }

  // Tasks provide granular progress.
  // Milestones provide higher-level delivery control.
  return Math.round(taskProgress * 0.8 + milestoneProgress * 0.2);
}