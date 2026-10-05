import fs from "fs";
import path from "path";
import { type Snapshot } from "./lib/types";
import { type StorageAdapter } from "./modules/persist";

/**
 * Stores snapshots in a JSON file (Node.js only). Writes go to a temporary file that is then
 * renamed over the target, so a crash mid-write can't leave a half-written file behind.
 */
export const jsonFileAdapter = (filePath: string): StorageAdapter => {
    const resolved = path.resolve(filePath);
    return {
        read: () => (fs.existsSync(resolved) ? (JSON.parse(fs.readFileSync(resolved, "utf-8")) as Snapshot) : undefined),
        write: data => {
            fs.mkdirSync(path.dirname(resolved), { recursive: true });
            const temp = `${resolved}.${process.pid}.tmp`;
            fs.writeFileSync(temp, JSON.stringify(data, null, 2));
            fs.renameSync(temp, resolved);
        },
    };
};
