// A minimal, in-memory, chainable fake of the Supabase query builder — just
// enough of the surface area (select/insert/update/upsert/delete/eq/in/order/
// maybeSingle/single/count) that this repo's route handlers actually use.
// Not a general PostgREST emulator: it doesn't enforce RLS, foreign keys, or
// check constraints. Tests that need to prove RLS-level access control (e.g.
// cross-client row visibility) test the app-level guard functions directly
// instead (src/lib/auth/authorize.ts) and note that the DB-level policy itself
// is verified separately (see supabase/MIGRATION_SYNC_REPORT.md) — this fake
// cannot exercise real Postgres RLS.

type Row = Record<string, any>;

function randomId(): string {
  return "id-" + Math.random().toString(36).slice(2, 10);
}

class FakeQueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] = [];
  private singleMode: "single" | "maybeSingle" | null = null;
  private orderCol?: string;
  private orderAsc = true;
  private countMode: "exact" | null = null;
  private headOnly = false;
  private onConflictCols?: string[];

  constructor(
    private tables: Record<string, Row[]>,
    private table: string,
  ) {
    if (!this.tables[table]) this.tables[table] = [];
  }

  select(_cols?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.payload = [patch];
    return this;
  }

  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.onConflictCols = opts?.onConflict?.split(",");
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }

  lt(col: string, val: string | number) {
    this.filters.push((r) => r[col] < val);
    return this;
  }

  gt(col: string, val: string | number) {
    this.filters.push((r) => r[col] > val);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(_n: number) {
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this.execute();
  }

  single() {
    this.singleMode = "single";
    return this.execute();
  }

  // Thenable, so `await builder` works even without .single()/.maybeSingle().
  then(onFulfilled: any, onRejected?: any) {
    return this.execute().then(onFulfilled, onRejected);
  }

  private matchRows(rows: Row[]) {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    const table = this.tables[this.table];
    let resultRows: Row[] = [];

    if (this.mode === "select") {
      resultRows = this.matchRows(table);
      if (this.orderCol) {
        const col = this.orderCol;
        resultRows = [...resultRows].sort((a, b) => {
          if (a[col] === b[col]) return 0;
          const cmp = a[col] > b[col] ? 1 : -1;
          return this.orderAsc ? cmp : -cmp;
        });
      }
    } else if (this.mode === "insert") {
      for (const r of this.payload) {
        const row = { id: r.id ?? randomId(), created_at: r.created_at ?? new Date().toISOString(), ...r };
        if (table.some((existing) => existing.id === row.id)) {
          return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
        }
        table.push(row);
        resultRows.push(row);
      }
    } else if (this.mode === "update") {
      const matched = this.matchRows(table);
      for (const row of matched) Object.assign(row, this.payload[0]);
      resultRows = matched;
    } else if (this.mode === "upsert") {
      const conflictCols = this.onConflictCols ?? ["id"];
      for (const r of this.payload) {
        const existing = table.find((row) => conflictCols.every((c) => row[c] === r[c]));
        if (existing) {
          Object.assign(existing, r);
          resultRows.push(existing);
        } else {
          const row = { id: r.id ?? randomId(), ...r };
          table.push(row);
          resultRows.push(row);
        }
      }
    } else if (this.mode === "delete") {
      const matched = this.matchRows(table);
      this.tables[this.table] = table.filter((r) => !matched.includes(r));
      resultRows = matched;
    }

    if (this.headOnly) {
      return { data: null, error: null, count: resultRows.length };
    }
    if (this.singleMode === "single") {
      if (resultRows.length !== 1) return { data: null, error: { message: "no rows", code: "PGRST116" } };
      return { data: resultRows[0], error: null };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: resultRows[0] ?? null, error: null };
    }
    return { data: resultRows, error: null, count: this.countMode ? resultRows.length : undefined };
  }
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [k, v] of Object.entries(seed)) this.tables[k] = v.map((r) => ({ ...r }));
  }

  from(table: string) {
    return new FakeQueryBuilder(this.tables, table);
  }
}
