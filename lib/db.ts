import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { STATUSES, type MirrorSubmission, type SubmissionRow, type SubmissionStatus } from "@/lib/types";

type SqliteDatabase = Database.Database;

const DEFAULT_SQLITE_PATH = path.join(process.cwd(), "data", "precision-mirror-finder.sqlite");
const statusConstraint = STATUSES.map((status) => `'${status}'`).join(", ");

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

export const createPostgresSubmissionsSql = `
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

const postgresUrl = process.env.POSTGRES_URL || (process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : "");
const shouldUsePostgres = Boolean(
  postgresUrl && (process.env.VERCEL || process.env.NODE_ENV === "production" || process.env.USE_POSTGRES === "true")
);
let sqliteDb: SqliteDatabase | undefined;
let postgresMigrated = false;

function isPostgres() {
  return shouldUsePostgres;
}

function sqlitePath() {
  return DEFAULT_SQLITE_PATH;
}

const sqliteColumnsToAdd = [
  "vin TEXT NOT NULL DEFAULT ''",
  "customer_email TEXT NOT NULL DEFAULT ''",
  "internal_debug TEXT NOT NULL DEFAULT ''",
  "tracking_number TEXT NOT NULL DEFAULT ''"
];

function migrateSqliteStatusConstraint(database: SqliteDatabase) {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'submissions'")
    .get() as { sql?: string } | undefined;

  if (
    !row?.sql ||
    (STATUSES.every((status) => row.sql?.includes(`'${status}'`)) &&
      !row.sql.includes("'Researching'") &&
      !row.sql.includes("'Quoted'") &&
      !row.sql.includes("'Ordered'"))
  ) {
    return;
  }

  database.exec(`
    ALTER TABLE submissions RENAME TO submissions_old;
    ${createSqliteSubmissionsSql}
    INSERT INTO submissions (
      id, created_at, vin, year, make, model, trim, features, side, color, customer_name, customer_phone, customer_email,
      status, matched_part_number, matched_part_price, supplier_name, supplier_link, estimated_shipping,
      quoted_price, notes, internal_debug, tracking_number
    )
    SELECT
      id, created_at, vin, year, make, model, trim, features, side, color, customer_name, customer_phone, customer_email,
      CASE
        WHEN status = 'Researching' THEN 'New'
        WHEN status = 'Quoted' THEN 'Quote Sent'
        WHEN status = 'Ordered' THEN 'Order Placed'
        ELSE status
      END,
      matched_part_number, matched_part_price, supplier_name, supplier_link, estimated_shipping,
      quoted_price, notes, internal_debug, tracking_number
    FROM submissions_old;
    DROP TABLE submissions_old;
  `);
}

function addMissingSqliteColumns(database: SqliteDatabase) {
  const existing = new Set(
    (database.prepare("PRAGMA table_info(submissions)").all() as Array<{ name: string }>).map((column) => column.name)
  );

  for (const columnDefinition of sqliteColumnsToAdd) {
    const columnName = columnDefinition.split(" ")[0];
    if (!existing.has(columnName)) {
      database.exec(`ALTER TABLE submissions ADD COLUMN ${columnDefinition};`);
    }
  }
}

function getSqliteDb() {
  if (!sqliteDb) {
    const dbPath = sqlitePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.exec(createSqliteSubmissionsSql);
    addMissingSqliteColumns(sqliteDb);
    migrateSqliteStatusConstraint(sqliteDb);
  }

  return sqliteDb;
}

async function queryPostgres(query: string, params: unknown[] = []) {
  if (!postgresUrl) {
    throw new Error("Postgres connection string is missing");
  }

  const { createPool } = await import("@vercel/postgres");
  const pool = createPool({ connectionString: postgresUrl });

  try {
    return await pool.query(query, params);
  } finally {
    await pool.end();
  }
}

export async function migrateDatabase() {
  if (!isPostgres()) {
    getSqliteDb();
    return;
  }

  if (postgresMigrated) return;

  await queryPostgres(createPostgresSubmissionsSql);
  postgresMigrated = true;
}

function normalizeRow(row: SubmissionRow): MirrorSubmission {
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  const features = Array.isArray(row.features) ? row.features : JSON.parse(row.features || "[]");

  return {
    ...row,
    created_at: createdAt,
    features: features as string[]
  };
}

export async function createSubmission(input: {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  features: string[];
  side: string;
  color: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
}) {
  await migrateDatabase();

  if (isPostgres()) {
    const result = await queryPostgres(
      `
      INSERT INTO submissions (
        vin, year, make, model, trim, features, side, color, customer_name, customer_phone, customer_email
      ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11
      )
      RETURNING id
    `,
      [
        input.vin,
        input.year,
        input.make,
        input.model,
        input.trim,
        JSON.stringify(input.features),
        input.side,
        input.color,
        input.customer_name,
        input.customer_phone,
        input.customer_email
      ]
    );

    return Number(result.rows[0].id);
  }

  const statement = getSqliteDb().prepare(`
    INSERT INTO submissions (
      vin, year, make, model, trim, features, side, color, customer_name, customer_phone, customer_email
    ) VALUES (
      @vin, @year, @make, @model, @trim, @features, @side, @color, @customer_name, @customer_phone, @customer_email
    )
  `);

  const result = statement.run({
    ...input,
    features: JSON.stringify(input.features)
  });

  return Number(result.lastInsertRowid);
}

export async function getSubmission(id: number): Promise<MirrorSubmission | null> {
  await migrateDatabase();

  if (isPostgres()) {
    const result = await queryPostgres("SELECT * FROM submissions WHERE id = $1", [id]);
    return result.rows[0] ? normalizeRow(result.rows[0] as SubmissionRow) : null;
  }

  const row = getSqliteDb().prepare("SELECT * FROM submissions WHERE id = ?").get(id) as SubmissionRow | undefined;
  return row ? normalizeRow(row) : null;
}

export async function listSubmissions(): Promise<MirrorSubmission[]> {
  await migrateDatabase();

  if (isPostgres()) {
    const result = await queryPostgres("SELECT * FROM submissions ORDER BY created_at DESC, id DESC");
    return result.rows.map((row) => normalizeRow(row as SubmissionRow));
  }

  const rows = getSqliteDb()
    .prepare("SELECT * FROM submissions ORDER BY datetime(created_at) DESC, id DESC")
    .all() as SubmissionRow[];

  return rows.map(normalizeRow);
}

export async function updateSubmission(id: number, input: {
  status: SubmissionStatus;
  matched_part_number: string;
  matched_part_price: string;
  supplier_name: string;
  supplier_link: string;
  estimated_shipping: string;
  quoted_price: string;
  notes: string;
  internal_debug?: string;
  tracking_number?: string;
}) {
  await migrateDatabase();

  if (!STATUSES.includes(input.status)) {
    throw new Error("Invalid submission status");
  }

  const values = {
    id,
    internal_debug: input.internal_debug || "",
    tracking_number: input.tracking_number || "",
    ...input
  };

  if (isPostgres()) {
    return queryPostgres(
      `
      UPDATE submissions SET
        status = $1,
        matched_part_number = $2,
        matched_part_price = $3,
        supplier_name = $4,
        supplier_link = $5,
        estimated_shipping = $6,
        quoted_price = $7,
        notes = $8,
        internal_debug = $9,
        tracking_number = $10
      WHERE id = $11
    `,
      [
        values.status,
        values.matched_part_number,
        values.matched_part_price,
        values.supplier_name,
        values.supplier_link,
        values.estimated_shipping,
        values.quoted_price,
        values.notes,
        values.internal_debug,
        values.tracking_number,
        id
      ]
    );
  }

  return getSqliteDb()
    .prepare(`
      UPDATE submissions SET
        status = @status,
        matched_part_number = @matched_part_number,
        matched_part_price = @matched_part_price,
        supplier_name = @supplier_name,
        supplier_link = @supplier_link,
        estimated_shipping = @estimated_shipping,
        quoted_price = @quoted_price,
        notes = @notes,
        internal_debug = @internal_debug,
        tracking_number = @tracking_number
      WHERE id = @id
    `)
    .run(values);
}

export async function deleteSubmission(id: number) {
  await migrateDatabase();

  if (isPostgres()) {
    return queryPostgres("DELETE FROM submissions WHERE id = $1", [id]);
  }

  return getSqliteDb().prepare("DELETE FROM submissions WHERE id = ?").run(id);
}
