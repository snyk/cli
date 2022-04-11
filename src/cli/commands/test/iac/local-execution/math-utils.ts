/**
 * Calculate percentage from relative and total amounts.
 * @param relativeValue The relative amount.
 * @param totalValue  The total amount.
 * @returns The calculated precentage.
 */
export const calculatePercentage = (
  relativeValue: number,
  totalValue: number,
): number => +(totalValue ? (relativeValue / totalValue) * 100 : 0).toFixed(2);
