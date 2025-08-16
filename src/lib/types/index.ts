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
     * @returns either an array of matching records or a single matching record.
     */
    find(query: { where: Partial<T> }): T[] | T;
    /**
     * Retrieves all records from the table.
     * @returns An array of all records.
     */
    all(): readonly T[];
    /**
     * Deletes records from the table.
     * @param query The query to use for deleting records.
     */
    delete(query: { where: Partial<T> }): void;
    /**
     * Updates records in the table.
     * @param query The query to use for finding records to update.
     * @param update The updated values to apply.
     */
    update(query: { where: Partial<T> }, update: Partial<T>): void;
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

export { Table, TableRecord, Database };