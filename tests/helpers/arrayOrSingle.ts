/**
 * Converts a value to an array if it's not already an array.
 * @param input - The input value to convert.
 * @returns The input value as an array.
 */
export const arrayOrSingle = <T>(input: T | T[]): T[] => Array.isArray(input) ? input : [input];
