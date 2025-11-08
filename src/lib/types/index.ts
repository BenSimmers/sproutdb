/**
 * Operators for advanced query conditions.
 */
type QueryOperators<T> = {
    $gt?: T;
    $gte?: T;
    $lt?: T;
    $lte?: T;
    $ne?: T;
    $in?: T[];
    $nin?: T[];
    $regex?: string | RegExp;
};

/**
 * A field condition that can be a simple value or use operators.
 */
type FieldCondition<T> = T | QueryOperators<T>;

/**
 * Complex where clause supporting operators and OR logic.
 */
type WhereClause<T> = {
    [K in keyof T]?: FieldCondition<T[K]>;
} & {
    $or?: WhereClause<T>[];
};

/**
 * Sort direction.
 */
type SortDirection = 'asc' | 'desc';

/**
 * Sort specification.
 */
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
 * Represents a table in the database.
 */
interface Table<T> {
    /**
     * Inserts a new record into the table.
     * @param record The record to insert.
     */
    insert(record: T): void;
    /**
     * Finds records in the table.
     * @param query The query to use for finding records.
     * @returns An array of matching records.
     */
    find(query?: QueryOptions<T>): T[];
    /**
     * Retrieves all records from the table.
     * @returns An array of all records.
     */
    all(): readonly T[];
    /**
     * Deletes records from the table.
     * @param query The query to use for deleting records.
     */
    delete(query: { where?: Partial<T> | WhereClause<T> }): void;
    /**
     * Updates records in the table.
     * @param query The query to use for finding records to update.
     * @param update The updated values to apply.
     */
    update(query: { where?: Partial<T> | WhereClause<T> }, update: Partial<T>): void;
    /**
     * Loads records into the table.
     * @param records The records to load.
     */
    load(records: readonly T[]): void;
}

/**
 * Represents a database containing multiple tables.
 */
type Database<TTables extends Record<string, Table<unknown>>> = { [K in keyof TTables]: TTables[K] };

/**
 * Represents a record in a table.
 */
type TableRecord = Record<string, Table<unknown>>;

/**
 * Validation error for schema validation.
 */
class ValidationError extends Error {
    constructor(message: string, public issues: unknown[]) {
        super(message);
        this.name = 'ValidationError';
    }
}

export { Table, TableRecord, Database, QueryOptions, WhereClause, SortClause, SortDirection, FieldCondition, QueryOperators, ValidationError };