import {
    Table,
    TableOptions,
    Schema,
    ChangeEvent,
    QueryOptions,
    WhereQuery,
    ValidationError,
    DuplicateKeyError,
} from "../lib/types";
import { clone, compareBy, deepEqual, matchesWhere } from "../lib/query";

const isSchema = <T>(value: unknown): value is Schema<T> =>
    typeof value === 'object' && value !== null && typeof (value as Schema<T>).safeParse === 'function';

/**
 * Creates a new table.
 * @param schemaOrOptions A validator with a `safeParse` method (e.g. a Zod schema), or table options.
 * @returns {Table<T>} A new table instance.
 */
export const table = <T>(schemaOrOptions?: Schema<T> | TableOptions<T>): Table<T> => {
    const options: TableOptions<T> = isSchema<T>(schemaOrOptions) ? { schema: schemaOrOptions } : schemaOrOptions ?? {};
    const { schema, key } = options;

    let data: T[] = [];
    const listeners = new Set<(event: ChangeEvent<T>) => void>();

    const emit = (event: ChangeEvent<T>) => {
        if (listeners.size === 0) return;
        const copy = { ...event, records: event.records.map(clone) };
        listeners.forEach(listener => listener(copy));
    };

    const validateRecord = (record: T): void => {
        if (!schema) return;

        const result = schema.safeParse(record);
        if (!result.success) {
            throw new ValidationError(
                `Validation failed: ${result.error.issues.map(i => i.message).join(', ')}`,
                [...result.error.issues]
            );
        }
    };

    const keyOf = (record: T) => (key === undefined ? undefined : record[key]);

    const checkKeys = (records: readonly T[], existing: readonly T[]): void => {
        if (key === undefined) return;
        const seen = existing.map(keyOf);
        for (const record of records) {
            const value = keyOf(record);
            if (value === undefined || value === null) {
                throw new ValidationError(`Missing key field "${String(key)}"`, []);
            }
            if (seen.some(other => deepEqual(other, value))) {
                throw new DuplicateKeyError(key, value);
            }
            seen.push(value);
        }
    };

    const requireKey = (method: string): keyof T => {
        if (key === undefined) {
            throw new Error(`table.${method}() requires the "key" table option`);
        }
        return key;
    };

    const filter = (where: WhereQuery<T>['where']) => (where ? data.filter(row => matchesWhere(row, where)) : data);

    const runQuery = (query?: QueryOptions<T>): T[] => {
        let results = filter(query?.where);

        if (query?.sort) {
            results = [...results].sort(compareBy(query.sort));
        }
        if (query?.offset !== undefined) {
            results = results.slice(query.offset);
        }
        if (query?.limit !== undefined) {
            results = results.slice(0, query.limit);
        }
        return results;
    };

    const project = (row: T, select?: readonly (keyof T)[]) => {
        if (!select) return clone(row);
        return Object.fromEntries(select.filter(field => field in (row as object)).map(field => [field, clone(row[field])]));
    };

    const insert = (record: T): T => {
        validateRecord(record);
        checkKeys([record], data);
        const stored = clone(record);
        data = [...data, stored];
        emit({ type: 'insert', records: [stored] });
        return clone(stored);
    };

    return {
        key,

        insert,

        find(query?: QueryOptions<T> & { select?: readonly (keyof T)[] }) {
            return runQuery(query).map(row => project(row, query?.select)) as T[];
        },

        findOne(query?: QueryOptions<T>) {
            const [row] = runQuery({ ...query, limit: 1 });
            return row === undefined ? undefined : clone(row);
        },

        count(query?: WhereQuery<T>) {
            return filter(query?.where).length;
        },

        get(value: T[keyof T]) {
            const field = requireKey('get');
            const row = data.find(row => deepEqual(row[field], value));
            return row === undefined ? undefined : clone(row);
        },

        upsert(record: T) {
            const field = requireKey('upsert');
            validateRecord(record);
            const index = data.findIndex(row => deepEqual(row[field], record[field]));
            if (index === -1) {
                return insert(record);
            }
            const stored = clone(record);
            data = data.map((row, i) => (i === index ? stored : row));
            emit({ type: 'update', records: [stored] });
            return clone(stored);
        },

        all() { return data.map(clone) as readonly T[]; },

        delete(query: WhereQuery<T>) {
            const removed = filter(query.where);
            if (removed.length === 0) return 0;
            const removedSet = new Set(removed);
            data = data.filter(row => !removedSet.has(row));
            emit({ type: 'delete', records: removed });
            return removed.length;
        },

        update(query: WhereQuery<T>, update: Partial<T>) {
            const targets = new Set(filter(query.where));
            if (targets.size === 0) return 0;

            // Build and validate every updated row before changing anything, so a failure leaves the table untouched.
            const updated: T[] = [];
            const next = data.map(row => {
                if (!targets.has(row)) return row;
                const merged = { ...row, ...clone(update) };
                validateRecord(merged);
                updated.push(merged);
                return merged;
            });
            if (key !== undefined && key in (update as object)) {
                checkKeys(next, []);
            }

            data = next;
            emit({ type: 'update', records: updated });
            return updated.length;
        },

        load(records: readonly T[]) {
            records.forEach(record => validateRecord(record));
            checkKeys(records, data);
            const stored = records.map(clone);
            data = [...data, ...stored];
            if (stored.length > 0) emit({ type: 'insert', records: stored });
            return stored.length;
        },

        clear() {
            if (data.length === 0) return;
            data = [];
            emit({ type: 'replace', records: [] });
        },

        restore(records: readonly T[]) {
            records.forEach(record => validateRecord(record));
            checkKeys(records, []);
            data = records.map(clone);
            emit({ type: 'replace', records: data });
        },

        subscribe(listener: (event: ChangeEvent<T>) => void) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    } as Table<T>;
};
