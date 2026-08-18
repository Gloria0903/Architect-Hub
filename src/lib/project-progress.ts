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

/**
 * Keep percentages between 0 and 100.
 */
export function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Calculate weighted task completion.
 *
 * Example:
 * Task A = 50% complete, weight 2
 * Task B = 100% complete, weight 1
 *
 * Result = (50*2 + 100*1) / 3 = 66.67%
 */
export function calculateTaskProgress(tasks: ProgressTask[]): number {
  if (!tasks.length) return 0;

  const totalWeight = tasks.reduce(
    (sum, task) => sum + Math.max(Number(task.weight) || 0, 0),
    0
  );

  if (totalWeight === 0) return 0;

  const weightedCompletion = tasks.reduce(
    (sum, task) => {
      const completion = clampPercentage(
        Number(task.completion) || 0
      );

      const weight = Math.max(
        Number(task.weight) || 0,
        0
      );

      return sum + completion * weight;
    },
    0
  );

  return Math.round(weightedCompletion / totalWeight);
}

/**
 * Calculate milestone progress based on completed/approved milestones.
 */
export function calculateMilestoneProgress(
  milestones: ProgressMilestone[]
): number {
  if (!milestones.length) return 0;

  const totalWeight = milestones.reduce(
    (sum, milestone) =>
      sum + Math.max(Number(milestone.weight) || 0, 0),
    0
  );

  if (totalWeight === 0) return 0;

  const completedWeight = milestones.reduce(
    (sum, milestone) => {
      const completed =
        milestone.status === MilestoneStatus.COMPLETED ||
        milestone.status === MilestoneStatus.APPROVED;

      const weight = Math.max(
        Number(milestone.weight) || 0,
        0
      );

      return sum + (completed ? weight : 0);
    },
    0
  );

  return Math.round(
    (completedWeight / totalWeight) * 100
  );
}

/**
 * Calculate overall physical project progress.
 *
 * Tasks = 80%
 * Milestones = 20%
 *
 * If only one exists, use that source directly.
 */
export function calculateProjectProgress({
  tasks,
  milestones,
}: {
  tasks: ProgressTask[];
  milestones: ProgressMilestone[];
}): number {
  const taskProgress = calculateTaskProgress(tasks);
  const milestoneProgress =
    calculateMilestoneProgress(milestones);

  if (!tasks.length && !milestones.length) {
    return 0;
  }

  if (!tasks.length) {
    return milestoneProgress;
  }

  if (!milestones.length) {
    return taskProgress;
  }

  return Math.round(
    taskProgress * 0.8 +
    milestoneProgress * 0.2
  );
}

/**
 * Financial calculations
 *
 * Contract value is the base for financial progress.
 *
 * Invoiced % = invoiced / contract value
 * Collected % = paid / contract value
 */
export function calculateFinancialProgress({
  contractValue,
  invoiced,
  paid,
}: {
  contractValue: number;
  invoiced: number;
  paid: number;
}) {
  const contract = Math.max(
    Number(contractValue) || 0,
    0
  );

  const invoiceAmount = Math.max(
    Number(invoiced) || 0,
    0
  );

  const paidAmount = Math.max(
    Number(paid) || 0,
    0
  );

  const invoicedPercentage =
    contract > 0
      ? clampPercentage(
          (invoiceAmount / contract) * 100
        )
      : 0;

  const collectedPercentage =
    contract > 0
      ? clampPercentage(
          (paidAmount / contract) * 100
        )
      : 0;

  const outstanding =
    Math.max(contract - paidAmount, 0);

  return {
    contractValue: contract,
    invoiced: invoiceAmount,
    paid: paidAmount,
    outstanding,
    invoicedPercentage,
    collectedPercentage,
  };
}