import { Table } from "../lib/types";

/**
 * Creates a new table.
 * @returns {Table<T>} A new table instance.
 */
export const table = <T>(): Table<T> => {
    let data: T[] = [];
    return {
        insert(record: T) { data.push(record); },
        find(query: { where: Partial<T> }) {
            const entries = Object.entries(query.where) as Array<[keyof T, T[keyof T]]>;
            if (!entries.length) return [...data];
            // Filter data based on the query
            const results = data.filter(row => entries.every(([k, v]) => row[k] === v));
            return results.length === 1 ? results[0] : results;
        },

        all() { return data as readonly T[]; },
        delete(query: { where: Partial<T> }) {
            const entries = Object.entries(query.where) as Array<[keyof T, T[keyof T]]>;
            data = data.filter(row => !entries.every(([k, v]) => row[k] === v));
        },
        update(query: { where: Partial<T> }, update: Partial<T>) {
            const entries = Object.entries(query.where) as Array<[keyof T, T[keyof T]]>;
            data = data.map(row => {
                if (entries.every(([k, v]) => row[k] === v)) {
                    return { ...row, ...update };
                }
                return row;
            });
        },
        load(records: readonly T[]) { data = [...data, ...records]; },
    };
};
