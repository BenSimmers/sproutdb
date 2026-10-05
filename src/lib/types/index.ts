/**
 * Operators for advanced query conditions.
 */
type QueryOperators<T> = {
    $eq?: T;
    $gt?: T;
    $gte?: T;
    $lt?: T;
    $lte?: T;
    $ne?: T;
    $in?: T[];
    $nin?: T[];
    $regex?: string | RegExp;
    $exists?: boolean;
    $not?: FieldCondition<T>;
};

/**
 * A field condition that can be a simple value or use operators.
 */
type FieldCondition<T> = T | QueryOperators<T>;

/**
 * Complex where clause supporting operators, AND/OR logic and dot-path fields (e.g. `"address.city"`).
 */
type WhereClause<T> = {
    [K in keyof T]?: FieldCondition<T[K]>;
} & {
    $or?: WhereClause<T>[];
    $and?: WhereClause<T>[];
} & {
    [path: `${string}.${string}`]: FieldCondition<unknown>;
};

type SortDirection = 'asc' | 'desc';

type SortClause<T> = {
    [K in keyof T]?: SortDirection;
};

/**
 * Advanced query options.
 */
type QueryOptions<T> = {
    where?: Partial<T> | WhereClause<T>;
    sort?: SortClause<T>;
    limit?: number;
    offset?: number;
};

/**
 * Query options with a field projection.
 */
type SelectQueryOptions<T, S extends keyof T> = QueryOptions<T> & {
    select: readonly S[];
};

/**
 * A query that only filters.
 */
type WhereQuery<T> = { where?: Partial<T> | WhereClause<T> };

/**
 * Any validator with a Zod-compatible `safeParse` method (Zod, Valibot adapters, hand-written, ...).
 * Zod is not a dependency of SproutDB; any object with this shape works.
 */
interface Schema<T> {
    safeParse(value: unknown):
        | { success: true; data?: T }
        | { success: false; error: { issues: ReadonlyArray<{ message: string }> } };
}

/**
 * Options for creating a table.
 */
type TableOptions<T> = {
    /** Validates records on insert, load, update, upsert and restore. */
    schema?: Schema<T>;
    /** Field used as the primary key: must be unique and enables `get` and `upsert`. */
    key?: keyof T;
};

/**
 * A change made to a table, delivered to `subscribe` listeners.
 * `records` are the rows as they are after the change (or as they were, for `delete`).
 */
type ChangeEvent<T> =
    | { type: 'insert' | 'update' | 'delete'; records: T[] }
    | { type: 'replace'; records: T[] };

/**
 * Represents a table in the database.
 */
interface Table<T> {
    /**
     * Inserts a new record into the table.
     * @returns A copy of the inserted record.
     */
    insert(record: T): T;
    /**
     * Finds records in the table.
     * @returns An array of matching records (copies).
     */
    find<S extends keyof T>(query: SelectQueryOptions<T, S>): Pick<T, S>[];
    find(query?: QueryOptions<T>): T[];
    /**
     * Finds the first matching record.
     */
    findOne(query?: QueryOptions<T>): T | undefined;
    /**
     * Counts matching records.
     */
    count(query?: WhereQuery<T>): number;
    /**
     * Gets a record by its primary key. Requires the `key` table option.
     */
    get(key: T[keyof T]): T | undefined;
    /**
     * Inserts the record, or replaces the existing record with the same primary key.
     * Requires the `key` table option.
     */
    upsert(record: T): T;
    /**
     * Retrieves all records from the table.
     */
    all(): readonly T[];
    /**
     * Deletes records from the table. With no `where`, deletes every record.
     * @returns The number of deleted records.
     */
    delete(query: WhereQuery<T>): number;
    /**
     * Updates records in the table. With no `where`, updates every record.
     * @returns The number of updated records.
     */
    update(query: WhereQuery<T>, update: Partial<T>): number;
    /**
     * Loads records into the table. Either all records are added or, if any is invalid, none are.
     * @returns The number of loaded records.
     */
    load(records: readonly T[]): number;
    /**
     * Removes every record.
     */
    clear(): void;
    /**
     * Replaces the table's contents with the given records (validated, all or nothing).
     */
    restore(records: readonly T[]): void;
    /**
     * Listens for changes. Returns a function that removes the listener.
     */
    subscribe(listener: (event: ChangeEvent<T>) => void): () => void;
    /**
     * The primary key field, if one was configured.
     */
    readonly key: keyof T | undefined;
}

/**
 * Represents a record in a table.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TableRecord = Record<string, Table<any>>;

/**
 * Represents a database containing multiple tables.
 */
type Database<TTables extends TableRecord> = { [K in keyof TTables]: TTables[K] };

/**
 * The data of every table in a database, keyed by table name.
 */
type Snapshot = Record<string, unknown[]>;

/**
 * Validation error for schema validation.
 */
class ValidationError extends Error {
    constructor(message: string, public issues: unknown[]) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Thrown when a write would create two records with the same primary key.
 */
class DuplicateKeyError extends Error {
    constructor(public key: PropertyKey, public value: unknown) {
        super(`Duplicate key: ${String(key)} = ${JSON.stringify(value)}`);
        this.name = 'DuplicateKeyError';
    }
}

/**
 * Thrown for malformed queries, such as an unknown `$` operator.
 */
class QueryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QueryError';
    }
}

export {
    Table,
    TableRecord,
    TableOptions,
    Schema,
    ChangeEvent,
    Database,
    Snapshot,
    QueryOptions,
    SelectQueryOptions,
    WhereQuery,
    WhereClause,
    SortClause,
    SortDirection,
    FieldCondition,
    QueryOperators,
    ValidationError,
    DuplicateKeyError,
    QueryError,
};
