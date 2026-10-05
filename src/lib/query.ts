import { FieldCondition, QueryError, QueryOperators, SortClause, WhereClause } from "./types";

/**
 * Checks if a value is a plain object (not an array, Date, RegExp or class instance).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * Structural equality for plain data (primitives, arrays, plain objects and Dates).
 */
export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        return aKeys.length === bKeys.length && aKeys.every(key => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
    }
    return false;
}

/**
 * Copies a record so callers can't mutate the table's internal state.
 */
export const clone = <T>(record: T): T => structuredClone(record);

/**
 * Reads a field from a row. Keys containing dots are treated as paths (`"address.city"`),
 * unless the row has a field with that exact name.
 */
export function getField(row: unknown, key: string): unknown {
    if (!isPlainObject(row)) return undefined;
    if (Object.hasOwn(row, key) || !key.includes('.')) return row[key];
    return key.split('.').reduce<unknown>((value, part) => (isPlainObject(value) || Array.isArray(value)
        ? (value as Record<string, unknown>)[part]
        : undefined), row);
}

/**
 * Checks if a condition is an operator object, e.g. `{ $gt: 1 }`.
 * Plain objects without `$`-prefixed keys are treated as values for equality instead.
 */
function isOperatorObject(condition: unknown): boolean {
    if (!isPlainObject(condition)) return false;
    const keys = Object.keys(condition);
    return keys.length > 0 && keys.every(key => key.startsWith('$'));
}

const KNOWN_OPERATORS = new Set(['$eq', '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin', '$regex', '$exists', '$not']);

/**
 * Checks if a row matches a where clause.
 * Every field condition must match, at least one `$or` branch must match, and every `$and` branch must match.
 */
export function matchesWhere<T>(row: T, where: Partial<T> | WhereClause<T>): boolean {
    return Object.entries(where).every(([key, condition]) => {
        if (key === '$or') {
            return (condition as WhereClause<T>[]).some(branch => matchesWhere(row, branch));
        }
        if (key === '$and') {
            return (condition as WhereClause<T>[]).every(branch => matchesWhere(row, branch));
        }
        return matchesField(getField(row, key), condition);
    });
}

/**
 * Checks if a field value matches a condition.
 */
export function matchesField<T>(value: T, condition: FieldCondition<T>): boolean {
    if (!isOperatorObject(condition)) {
        return deepEqual(value, condition);
    }

    const ops = condition as QueryOperators<T>;
    const unknownOperator = Object.keys(ops).find(key => !KNOWN_OPERATORS.has(key));
    if (unknownOperator) {
        throw new QueryError(`Unknown query operator: ${unknownOperator}`);
    }

    if ('$eq' in ops && !deepEqual(value, ops.$eq)) return false;
    if (ops.$gt != null && !(value > ops.$gt)) return false;
    if (ops.$gte != null && !(value >= ops.$gte)) return false;
    if (ops.$lt != null && !(value < ops.$lt)) return false;
    if (ops.$lte != null && !(value <= ops.$lte)) return false;
    if (ops.$ne !== undefined && deepEqual(value, ops.$ne)) return false;
    if (ops.$in !== undefined && !ops.$in.some(item => deepEqual(value, item))) return false;
    if (ops.$nin !== undefined && ops.$nin.some(item => deepEqual(value, item))) return false;
    if (ops.$regex !== undefined) {
        const regex = ops.$regex instanceof RegExp ? ops.$regex : toRegExp(ops.$regex);
        if (!regex.test(String(value))) return false;
    }
    if (ops.$exists !== undefined && (value !== undefined) !== ops.$exists) return false;
    if (ops.$not !== undefined && matchesField(value, ops.$not)) return false;

    return true;
}

function toRegExp(pattern: string): RegExp {
    try {
        return new RegExp(pattern);
    } catch (error) {
        throw new QueryError(`Invalid $regex: ${(error as Error).message}`);
    }
}

/**
 * Builds a comparator for a sort clause. `undefined` and `null` sort last in ascending order.
 */
export function compareBy<T>(sort: SortClause<T>): (a: T, b: T) => number {
    return (a, b) => {
        for (const [field, direction] of Object.entries(sort)) {
            const aVal = getField(a, field) as T[keyof T];
            const bVal = getField(b, field) as T[keyof T];
            let cmp = 0;
            if (aVal == null || bVal == null) cmp = aVal == null ? (bVal == null ? 0 : 1) : -1;
            else if (aVal < bVal) cmp = -1;
            else if (aVal > bVal) cmp = 1;
            if (cmp !== 0) {
                return direction === 'desc' ? -cmp : cmp;
            }
        }
        return 0;
    };
}
