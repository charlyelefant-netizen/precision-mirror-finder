import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const envFile = process.argv.find((arg) => arg.startsWith("--env-file="))?.replace("--env-file=", "") || ".env.local";

if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const STATUSES = ["New", "Ready to Quote", "Quote Sent", "Order Placed", "Completed", "Manual Review"];
const statusConstraint = STATUSES.map((status) => `'${status}'`).join(", ");
const postgresUrl = process.env.POSTGRES_URL || (process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : "");
const shouldMigratePostgres = Boolean(
  postgresUrl && (process.env.VERCEL || process.env.USE_POSTGRES === "true" || process.argv.includes("--postgres"))
);
const sqlitePath = process.env.DATABASE_URL?.startsWith("file:")
  ? path.resolve(process.cwd(), process.env.DATABASE_URL.replace("file:", ""))
  : path.join(process.cwd(), "data", "precision-mirror-finder.sqlite");

const createSqliteSubmissionsSql = `
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vin TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    trim TEXT NOT NULL,
    features TEXT NOT NULL DEFAULT '[]',
    side TEXT NOT NULL,
    color TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'New',
    matched_part_number TEXT NOT NULL DEFAULT '',
    matched_part_price TEXT NOT NULL DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    supplier_link TEXT NOT NULL DEFAULT '',
    estimated_shipping TEXT NOT NULL DEFAULT '',
    quoted_price TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    internal_debug TEXT NOT NULL DEFAULT '',
    tracking_number TEXT NOT NULL DEFAULT '',
    CHECK (status IN (${statusConstraint}))
  );
`;

const createPostgresSubmissionsSql = `
  CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vin TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    trim TEXT NOT NULL,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    side TEXT NOT NULL,
    color TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN (${statusConstraint})),
    matched_part_number TEXT NOT NULL DEFAULT '',
    matched_part_price TEXT NOT NULL DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    supplier_link TEXT NOT NULL DEFAULT '',
    estimated_shipping TEXT NOT NULL DEFAULT '',
    quoted_price TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    internal_debug TEXT NOT NULL DEFAULT '',
    tracking_number TEXT NOT NULL DEFAULT ''
  );
`;

function migrateSqlite() {
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.exec(createSqliteSubmissionsSql);

  const existing = new Set(db.prepare("PRAGMA table_info(submissions)").all().map((column) => column.name));
  for (const column of [
    "vin TEXT NOT NULL DEFAULT ''",
    "customer_email TEXT NOT NULL DEFAULT ''",
    "internal_debug TEXT NOT NULL DEFAULT ''",
    "tracking_number TEXT NOT NULL DEFAULT ''"
  ]) {
    const columnName = column.split(" ")[0];
    if (!existing.has(columnName)) {
      db.exec(`ALTER TABLE submissions ADD COLUMN ${column};`);
    }
  }

  db.close();
  console.log(`SQLite schema ready at ${sqlitePath}`);
}

async function migratePostgres() {
  const { createPool } = await import("@vercel/postgres");
  const pool = createPool({ connectionString: postgresUrl });

  try {
    await pool.query(createPostgresSubmissionsSql);
  } finally {
    await pool.end();
  }

  console.log("Vercel Postgres schema ready.");
}

if (shouldMigratePostgres) {
  await migratePostgres();
} else {
  migrateSqlite();
}
