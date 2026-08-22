import { describe, expect, it } from "vitest";
import {
  clampPercentage,
  calculateTaskProgress,
  calculateMilestoneProgress,
  calculateProjectProgress,
  calculateFinancialProgress,
} from "./project-progress";
import type { TaskStatus, MilestoneStatus } from "@prisma/client";

// Using the literal string values rather than importing the TaskStatus/
// MilestoneStatus runtime enum objects -- these are just string enums
// under the hood, so this is exactly equivalent, but doesn't depend on
// a fully generated Prisma client to run (this file's own logic has
// nothing to do with the database at all).
const IN_PROGRESS = "IN_PROGRESS" as TaskStatus;
const TASK_COMPLETED = "COMPLETED" as TaskStatus;
const MILESTONE_COMPLETED = "COMPLETED" as MilestoneStatus;
const APPROVED = "APPROVED" as MilestoneStatus;
const PENDING = "PENDING" as MilestoneStatus;

describe("clampPercentage", () => {
  it("leaves in-range values untouched", () => {
    expect(clampPercentage(42)).toBe(42);
  });
  it("clamps above 100 down to 100", () => {
    expect(clampPercentage(150)).toBe(100);
  });
  it("clamps below 0 up to 0", () => {
    expect(clampPercentage(-10)).toBe(0);
  });
});

describe("calculateTaskProgress", () => {
  it("returns 0 for no tasks", () => {
    expect(calculateTaskProgress([])).toBe(0);
  });

  it("weights each task's completion by its weight", () => {
    // Task A: 50% complete, weight 2. Task B: 100% complete, weight 1.
    // (50*2 + 100*1) / 3 = 66.67 -> rounds to 67.
    const result = calculateTaskProgress([
      { weight: 2, completion: 50, status: IN_PROGRESS },
      { weight: 1, completion: 100, status: TASK_COMPLETED },
    ]);
    expect(result).toBe(67);
  });

  it("treats equal weights as a plain average", () => {
    const result = calculateTaskProgress([
      { weight: 1, completion: 20, status: IN_PROGRESS },
      { weight: 1, completion: 80, status: IN_PROGRESS },
    ]);
    expect(result).toBe(50);
  });

  it("returns 0 rather than dividing by zero when every task has zero weight", () => {
    const result = calculateTaskProgress([
      { weight: 0, completion: 100, status: TASK_COMPLETED },
    ]);
    expect(result).toBe(0);
  });

  it("clamps an out-of-range completion value before weighting it", () => {
    const result = calculateTaskProgress([
      { weight: 1, completion: 150, status: TASK_COMPLETED },
    ]);
    expect(result).toBe(100);
  });
});

describe("calculateMilestoneProgress", () => {
  it("returns 0 for no milestones", () => {
    expect(calculateMilestoneProgress([])).toBe(0);
  });

  it("counts COMPLETED and APPROVED as done, everything else as not", () => {
    const result = calculateMilestoneProgress([
      { weight: 1, status: MILESTONE_COMPLETED },
      { weight: 1, status: APPROVED },
      { weight: 2, status: PENDING },
    ]);
    // (1 + 1) done out of (1+1+2) total weight = 50%
    expect(result).toBe(50);
  });

  it("returns 0 rather than dividing by zero when every milestone has zero weight", () => {
    const result = calculateMilestoneProgress([
      { weight: 0, status: MILESTONE_COMPLETED },
    ]);
    expect(result).toBe(0);
  });
});

describe("calculateProjectProgress", () => {
  it("returns 0 when there are neither tasks nor milestones", () => {
    expect(calculateProjectProgress({ tasks: [], milestones: [] })).toBe(0);
  });

  it("uses task progress directly when there are no milestones (the real-world case today -- nothing in the app currently creates milestones)", () => {
    const result = calculateProjectProgress({
      tasks: [{ weight: 1, completion: 75, status: IN_PROGRESS }],
      milestones: [],
    });
    expect(result).toBe(75);
  });

  it("uses milestone progress directly when there are no tasks", () => {
    const result = calculateProjectProgress({
      tasks: [],
      milestones: [{ weight: 1, status: MILESTONE_COMPLETED }],
    });
    expect(result).toBe(100);
  });

  it("blends 80% tasks / 20% milestones when both exist", () => {
    // Tasks 100% complete, milestones 0% complete.
    // 100*0.8 + 0*0.2 = 80
    const result = calculateProjectProgress({
      tasks: [{ weight: 1, completion: 100, status: TASK_COMPLETED }],
      milestones: [{ weight: 1, status: PENDING }],
    });
    expect(result).toBe(80);
  });
});

describe("calculateFinancialProgress", () => {
  it("computes invoiced/collected percentages against contract value", () => {
    const result = calculateFinancialProgress({
      contractValue: 1_000_000,
      invoiced: 400_000,
      paid: 250_000,
    });
    expect(result.invoicedPercentage).toBe(40);
    expect(result.collectedPercentage).toBe(25);
    expect(result.outstanding).toBe(750_000);
  });

  it("returns 0% for both when there is no contract value, instead of dividing by zero", () => {
    const result = calculateFinancialProgress({
      contractValue: 0,
      invoiced: 0,
      paid: 0,
    });
    expect(result.invoicedPercentage).toBe(0);
    expect(result.collectedPercentage).toBe(0);
  });

  it("never lets paid exceed contract value drive outstanding negative", () => {
    const result = calculateFinancialProgress({
      contractValue: 100,
      invoiced: 100,
      paid: 150, // shouldn't happen given the API's own guards, but the math itself should still hold
    });
    expect(result.outstanding).toBe(0);
  });
});
