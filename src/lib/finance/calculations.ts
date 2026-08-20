/**
 * Shared finance calculations for Architect Hub.
 *
 * IMPORTANT:
 * Keep all project-level and portfolio-level financial calculations
 * here so that the Project page and Finance page always display
 * consistent numbers.
 *
 * Financial definitions:
 *
 * budget          = total project / contract value
 * invoiced        = total amount billed to the client
 * paid            = total amount received from the client
 * outstanding     = invoiced - paid
 * remainingBudget = budget - invoiced
 *
 * All percentages use the project budget as their denominator.
 */

export interface FinanceProjectInput {
  budget: number | null | undefined;
  invoiced: number | null | undefined;
  paid: number | null | undefined;
}

export interface ProjectFinanceSummary {
  budget: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  remainingBudget: number;
  invoicedPercentage: number;
  paidPercentage: number;
  outstandingPercentage: number;
}

/**
 * Safely converts a value into a finite number.
 *
 * null, undefined, NaN and Infinity become 0.
 */
export function toFinanceNumber(
  value: number | null | undefined
): number {
  const numberValue = Number(value ?? 0);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * Round a monetary value to two decimal places.
 *
 * Prevents floating-point precision issues.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate the complete financial state of a project.
 */
export function calculateProjectFinance(
  project: FinanceProjectInput
): ProjectFinanceSummary {
  const budget = roundMoney(toFinanceNumber(project.budget));

  const invoiced = roundMoney(toFinanceNumber(project.invoiced));

  const paid = roundMoney(toFinanceNumber(project.paid));

  // Amount invoiced but not yet paid.
  const outstanding = roundMoney(
    Math.max(invoiced - paid, 0)
  );

  // Amount of the project budget that has not yet been invoiced.
  const remainingBudget = roundMoney(
    Math.max(budget - invoiced, 0)
  );

  // All percentages use the project budget as the denominator.
  const invoicedPercentage =
    budget > 0
      ? roundMoney((invoiced / budget) * 100)
      : 0;

  const paidPercentage =
    budget > 0
      ? roundMoney((paid / budget) * 100)
      : 0;

  const outstandingPercentage =
    budget > 0
      ? roundMoney((outstanding / budget) * 100)
      : 0;

  return {
    budget,
    invoiced,
    paid,
    outstanding,
    remainingBudget,
    invoicedPercentage,
    paidPercentage,
    outstandingPercentage,
  };
}

/**
 * Calculate the total financial position across multiple projects.
 */
/**
 * Calculate the total financial position across multiple projects.
 */
export function calculatePortfolioFinance(
  projects: FinanceProjectInput[]
): ProjectFinanceSummary {
  let budget = 0;
  let invoiced = 0;
  let paid = 0;

  for (const project of projects) {
    budget += toFinanceNumber(project.budget);
    invoiced += toFinanceNumber(project.invoiced);
    paid += toFinanceNumber(project.paid);
  }

  return calculateProjectFinance({
    budget,
    invoiced,
    paid,
  });
}

/**
 * Calculate the outstanding amount directly.
 *
 * Useful when the complete finance summary is not required.
 */
export function calculateOutstanding(
  invoiced: number | null | undefined,
  paid: number | null | undefined
): number {
  return roundMoney(
    Math.max(
      toFinanceNumber(invoiced) -
        toFinanceNumber(paid),
      0
    )
  );
}

/**
 * Calculate the remaining project budget.
 */
export function calculateRemainingBudget(
  budget: number | null | undefined,
  invoiced: number | null | undefined
): number {
  return roundMoney(
    Math.max(
      toFinanceNumber(budget) -
        toFinanceNumber(invoiced),
      0
    )
  );
}