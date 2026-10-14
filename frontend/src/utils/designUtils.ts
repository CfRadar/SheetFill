/**
 * Utility functions for resolving design data consistently across list and editor components.
 */

export function resolveDesignSizes(customSizes?: string[], sizesFound?: string[]): string[] {
  if (customSizes && customSizes.length > 0) {
    return customSizes;
  }
  if (sizesFound && sizesFound.length > 0) {
    return sizesFound;
  }
  return ["S", "M", "L", "XL"];
}
