
import * as duckdb from "@duckdb/duckdb-wasm";

import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

const bundles: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

export type SqlSession = {
  db: duckdb.AsyncDuckDB;
  connection: duckdb.AsyncDuckDBConnection;
  worker: Worker;
  rowsLoaded: number;
};

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
};

export async function createSession(
  file: File
): Promise<SqlSession> {
  const bundle = await duckdb.selectBundle(bundles);
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(
    new duckdb.ConsoleLogger(),
    worker
  );

  let connection: duckdb.AsyncDuckDBConnection | null = null;

  try {
    await db.instantiate(
      bundle.mainModule,
      bundle.pthreadWorker
    );

    await db.registerFileBuffer(
      "source.csv",
      new Uint8Array(await file.arrayBuffer())
    );

    connection = await db.connect();

    // Keep values as text initially to avoid changing
    // the meaning of the uploaded fields.
    // NA remains literal text; blanks become SQL NULL.
    await connection.query(`
      CREATE TABLE uploaded_data AS
      SELECT *
      FROM read_csv(
        'source.csv',
        header = true,
        all_varchar = true,
        nullstr = ''
      )
    `);

    const count = await connection.query(
      "SELECT COUNT(*) AS total FROM uploaded_data"
    );

    return {
      db,
      connection,
      worker,
      rowsLoaded: Number(count.toArray()[0].total),
    };
  } catch (error) {
    if (connection) {
      await connection.close().catch(() => {});
    }
    await db.terminate().catch(() => {});
    worker.terminate();
    throw error;
  }
}

export async function runReadOnlyQuery(
  session: SqlSession,
  sql: string
): Promise<QueryResult> {
  const cleaned = sql.trim().replace(/;\s*$/, "");

  // Basic MVP guard: allow one SELECT statement only.
  // This is not a complete SQL security sandbox.
  if (!/^SELECT\b/i.test(cleaned) || cleaned.includes(";")) {
    throw new Error(
      "This MVP supports one SELECT query at a time."
    );
  }

  // Protect the UI from huge results.
  const table = await session.connection.query(`
    SELECT *
    FROM (${cleaned}) AS datalens_result
    LIMIT 5001
  `);

  const records = table
    .toArray()
    .map((row) => row.toJSON() as Record<string, unknown>);

  return {
    columns: table.schema.fields.map((field) => field.name),
    rows: records.slice(0, 5000),
    truncated: records.length > 5000,
  };
}

export async function closeSession(
  session: SqlSession
) {
  await session.connection.close().catch(() => {});
  await session.db.terminate().catch(() => {});
  session.worker.terminate();
}
