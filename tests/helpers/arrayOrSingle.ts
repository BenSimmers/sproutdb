export const arrayOrSingle = <T>(input: T | T[]): T[] => Array.isArray(input) ? input : [input];
