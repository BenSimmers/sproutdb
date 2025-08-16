import { type Database, type TableRecord } from "../lib/types";

/**
 * Create a new database instance.
 * @param tables - The table definitions to include in the database.
 * @returns The created database instance.
 */
export const create = <TTables extends TableRecord>(tables: TTables): Database<TTables> => tables;
