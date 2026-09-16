/**
 * Minimal in-memory stand-in for the subset of the supabase-js query builder
 * that the data layer uses (`from().select/insert/upsert/update/delete`,
 * `.eq/.in/.order/.maybeSingle/.single/.throwOnError`, `rpc`). It models the
 * natural unique keys from the migrations so upsert/idempotency semantics are
 * exercised for real, without a network or a container.
 *
 * It is NOT a Postgres emulator: no RLS, no realtime, no check constraints.
 * Real Auth/RLS/Realtime semantics are covered by the hosted-branch suites.
 */
export type Row = Record<string, unknown>;

const UNIQUE_KEYS: Record<string, string[][]> = {
  food_entries: [["id"]],
  meal_statuses: [["id"], ["profile_id", "log_date", "slot"]],
  fasting_logs: [["id"], ["profile_id", "log_date"]],
  workout_logs: [["id"], ["profile_id", "log_date"]],
  weigh_ins: [["id"]],
  foods: [["id"], ["household_id", "normalized_name"]],
  food_preferences: [["id"], ["profile_id", "food_id"]],
  profiles: [["id"]],
  households: [["id"]],
};

interface Filter {
  col: string;
  op: "eq" | "in";
  val: unknown;
}

type Action =
  | { type: "select" }
  | { type: "insert"; rows: Row[] }
  | { type: "upsert"; rows: Row[]; onConflict?: string }
  | { type: "update"; patch: Row }
  | { type: "delete" };

interface Result {
  data: unknown;
  error: { code: string; message: string } | null;
}

export class FakeSupabase {
  tables = new Map<string, Row[]>();
  /** Every executed mutation, in order — handy for asserting narrowness. */
  log: Array<{ table: string; action: string; rows?: Row[]; filters?: Filter[] }> = [];
  realtime = { setAuth: (_token: string) => {} };

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  seed(table: string, rows: Row[]): void {
    this.rows(table).push(...rows.map((r) => ({ id: crypto.randomUUID(), ...r })));
  }

  from(table: string) {
    return new Query(this, table);
  }

  async rpc(name: string): Promise<Result> {
    if (name === "bootstrap_household") {
      const h = this.rows("households")[0];
      return { data: h?.id ?? null, error: null };
    }
    return { data: null, error: { code: "42883", message: `unknown rpc ${name}` } };
  }

  /** Realtime handlers registered via channel().on(), keyed by table. */
  handlers = new Map<string, Array<(payload: unknown) => void>>();
  channelCount = 0;

  channel() {
    this.channelCount += 1;
    const ch = {
      on: (_ev: string, filter: { table: string }, cb: (payload: unknown) => void) => {
        const list = this.handlers.get(filter.table) ?? [];
        list.push(cb);
        this.handlers.set(filter.table, list);
        return ch;
      },
      subscribe: () => ch,
    };
    return ch;
  }
  removeChannel() {
    this.handlers.clear();
    return Promise.resolve("ok");
  }

  /** Simulates a postgres_changes event as the realtime socket would deliver it. */
  emit(table: string, eventType: "INSERT" | "UPDATE" | "DELETE", row: Row, old: Row = {}) {
    for (const cb of this.handlers.get(table) ?? []) {
      cb({
        eventType,
        new: eventType === "DELETE" ? {} : row,
        old: eventType === "DELETE" ? old : {},
      });
    }
  }

  /** Simulates a network outage: every query rejects like fetch would. */
  offline = false;

  // --- execution ---------------------------------------------------------------
  execute(table: string, action: Action, filters: Filter[], mode: "many" | "single" | "maybe") {
    const rows = this.rows(table);
    const matches = (r: Row) =>
      filters.every((f) =>
        f.op === "eq" ? r[f.col] === f.val : (f.val as unknown[]).includes(r[f.col]),
      );
    const finish = (data: unknown): Result => {
      if (mode === "many") return { data, error: null };
      const list = data as Row[];
      if (mode === "single" && list.length !== 1) {
        return { data: null, error: { code: "PGRST116", message: "expected one row" } };
      }
      return { data: list[0] ?? null, error: null };
    };

    switch (action.type) {
      case "select": {
        this.log.push({ table, action: "select", filters });
        return finish(rows.filter(matches).map((r) => ({ ...r })));
      }
      case "insert": {
        this.log.push({ table, action: "insert", rows: action.rows });
        for (const r of action.rows) {
          const dup = this.findConflict(table, rows, r);
          if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
          rows.push(this.withDefaults(r));
        }
        return finish(action.rows);
      }
      case "upsert": {
        this.log.push({ table, action: "upsert", rows: action.rows });
        for (const r of action.rows) {
          const keyCols = action.onConflict ? action.onConflict.split(",") : ["id"];
          const existing = rows.find((x) =>
            keyCols.every((c) => r[c] !== undefined && x[c] === r[c]),
          );
          if (existing) Object.assign(existing, r, { updated_at: new Date().toISOString() });
          else {
            const dup = this.findConflict(table, rows, r);
            if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
            rows.push(this.withDefaults(r));
          }
        }
        return finish(action.rows);
      }
      case "update": {
        this.log.push({ table, action: "update", rows: [action.patch], filters });
        const hit = rows.filter(matches);
        for (const r of hit) Object.assign(r, action.patch);
        return finish(hit);
      }
      case "delete": {
        this.log.push({ table, action: "delete", filters });
        const keep = rows.filter((r) => !matches(r));
        const removed = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        return finish(new Array(removed).fill({}));
      }
    }
  }

  private withDefaults(r: Row): Row {
    return { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r };
  }

  private findConflict(table: string, rows: Row[], r: Row): Row | undefined {
    for (const key of UNIQUE_KEYS[table] ?? [["id"]]) {
      if (key.some((c) => r[c] === undefined)) continue;
      const hit = rows.find((x) => key.every((c) => x[c] === r[c]));
      if (hit) return hit;
    }
    return undefined;
  }
}

class Query implements PromiseLike<Result> {
  private action: Action = { type: "select" };
  private filters: Filter[] = [];
  private mode: "many" | "single" | "maybe" = "many";
  private throwing = false;

  constructor(
    private db: FakeSupabase,
    private table: string,
  ) {}

  select(_cols?: string) {
    if (this.action.type === "select") this.action = { type: "select" };
    return this;
  }
  insert(rows: Row | Row[]) {
    this.action = { type: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.action = {
      type: "upsert",
      rows: Array.isArray(rows) ? rows : [rows],
      onConflict: opts?.onConflict,
    };
    return this;
  }
  update(patch: Row) {
    this.action = { type: "update", patch };
    return this;
  }
  delete() {
    this.action = { type: "delete" };
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ col, op: "in", val });
    return this;
  }
  order() {
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  throwOnError() {
    this.throwing = true;
    return this;
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const run = async (): Promise<Result> => {
      if (this.db.offline) throw new TypeError("Failed to fetch");
      const res = this.db.execute(this.table, this.action, this.filters, this.mode);
      if (this.throwing && res.error) throw res.error;
      return res;
    };
    return run().then(onfulfilled, onrejected);
  }
}
