import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
// Prisma's Windows schema engine requires the SQLite file to exist before migrate.
if (!existsSync("prisma/dev.db")) new DatabaseSync("prisma/dev.db").close();
