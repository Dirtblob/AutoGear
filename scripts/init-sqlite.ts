import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";

const databasePath = join(process.cwd(), "prisma", "dev.db");

mkdirSync(dirname(databasePath), { recursive: true });

if (!existsSync(databasePath)) {
  closeSync(openSync(databasePath, "w"));
  console.log(`Created ${databasePath}`);
} else {
  console.log(`${databasePath} already exists`);
}
