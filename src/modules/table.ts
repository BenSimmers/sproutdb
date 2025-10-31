import { Table, QueryOptions, WhereClause, FieldCondition, QueryOperators } from "../lib/types";

/**
 * Checks if a row matches a where clause.
 */
function matchesWhere<T>(row: T, where: Partial<T> | WhereClause<T>): boolean {
    // Handle simple partial match (backward compatibility)
    if (!('$or' in where)) {
        const simpleWhere = where as Partial<T>;
        return Object.entries(simpleWhere).every(([key, value]) => {
            return matchesField(row[key as keyof T], value);
        });
    }

    // Handle complex where clause
    const complexWhere = where as WhereClause<T>;

    // Check $or conditions
    if (complexWhere.$or) {
        return complexWhere.$or.some(orCondition => matchesWhere(row, orCondition));
    }

    // Check field conditions
    for (const [key, condition] of Object.entries(complexWhere)) {
        if (key === '$or') continue;
        if (!matchesField(row[key as keyof T], condition as FieldCondition<T[keyof T]>)) {
            return false;
        }
    }

    return true;
}

/**
 * Checks if a field value matches a condition.
 */
function matchesField<T>(value: T, condition: FieldCondition<T>): boolean {
    // Simple equality
    if (typeof condition !== 'object' || condition === null) {
        return value === condition;
    }

    // Operator conditions
    const ops = condition as QueryOperators<T>;
    if (ops.$gt != null) {
        if (!(value > ops.$gt)) return false;
    }
    if (ops.$gte != null) {
        if (!(value >= ops.$gte)) return false;
    }
    if (ops.$lt != null) {
        if (!(value < ops.$lt)) return false;
    }
    if (ops.$lte != null) {
        if (!(value <= ops.$lte)) return false;
    }
    if (ops.$ne != null) {
        if (!(value !== ops.$ne)) return false;
    }
    if (ops.$in != null) {
        if (!ops.$in.includes(value)) return false;
    }
    if (ops.$nin != null) {
        if (ops.$nin.includes(value)) return false;
    }
    if (ops.$regex != null) {
        const regex = ops.$regex instanceof RegExp ? ops.$regex : new RegExp(ops.$regex);
        if (!regex.test(String(value))) return false;
    }

    // If no operators matched, treat as equality
    if (Object.keys(condition).length === 0) {
        return value === condition;
    }

    return true;
}

/**
 * Creates a new table.
 * @returns {Table<T>} A new table instance.
 */
export const table = <T>(): Table<T> => {
    let data: T[] = [];
    return {
        insert(record: T) { data.push(record); },
        find(query?: QueryOptions<T>) {
            let results = [...data];

            // Apply where filtering
            if (query?.where) {
                results = results.filter(row => matchesWhere(row, query.where!));
            }

            // Apply sorting
            if (query?.sort) {
                results.sort((a, b) => {
                    for (const [field, direction] of Object.entries(query.sort!)) {
                        const aVal = a[field as keyof T];
                        const bVal = b[field as keyof T];
                        let cmp = 0;
                        if (aVal < bVal) cmp = -1;
                        else if (aVal > bVal) cmp = 1;
                        if (cmp !== 0) {
                            return direction === 'desc' ? -cmp : cmp;
                        }
                    }
                    return 0;
                });
            }

            // Apply offset
            if (query?.offset) {
                results = results.slice(query.offset);
            }

            // Apply limit
            if (query?.limit) {
                results = results.slice(0, query.limit);
            }

            return results;
        },

        all() { return data as readonly T[]; },
        delete(query: { where?: Partial<T> | WhereClause<T> }) {
            if (!query.where) {
                data = [];
                return;
            }
            data = data.filter(row => !matchesWhere(row, query.where!));
        },
        update(query: { where?: Partial<T> | WhereClause<T> }, update: Partial<T>) {
            if (!query.where) {
                data = data.map(row => ({ ...row, ...update }));
                return;
            }
            data = data.map(row => {
                if (matchesWhere(row, query.where!)) {
                    return { ...row, ...update };
                }
                return row;
            });
        },
        load(records: readonly T[]) { data = [...data, ...records]; },
    };
};
