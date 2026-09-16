import { describe, it, expect, vi } from "vitest";
import { classifyError, drainQueue, errorMessage } from "./drain";
import type { Operation, QueuedOperation } from "./operations";

const op = (id: string): Operation => ({
  kind: "entry.upsert",
  profile: "me",
  iso: "2026-09-16",
  slot: "lunch",
  entry: { id, foodId: "f", foodName: "x", mode: "subjective", subjective: "מעט" },
});

function makeQueue(ids: string[]) {
  let items: QueuedOperation[] = ids.map((id) => ({
    id,
    key: `entry:${id}`,
    op: op(id),
    createdAt: "2026-09-16T00:00:00Z",
    retryCount: 0,
  }));
  return {
    items: () => items,
    deps: {
      pending: () => items.filter((m) => !m.quarantined),
      remove: (id: string) => {
        items = items.filter((m) => m.id !== id);
      },
      markFailure: (id: string, error: string, max = 5) => {
        const m = items.find((x) => x.id === id)!;
        m.retryCount += 1;
        m.lastError = error;
        if (m.retryCount >= max) m.quarantined = true;
      },
      quarantine: (id: string, error: string) => {
        const m = items.find((x) => x.id === id)!;
        m.quarantined = true;
        m.lastError = error;
      },
    },
  };
}

describe("classifyError", () => {
  it("treats fetch failures and offline as network", () => {
    expect(classifyError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyError({ message: "fetch failed" })).toBe("network");
    expect(classifyError({ message: "anything" }, false)).toBe("network");
  });
  it("treats constraint / RLS / bad-request errors as permanent", () => {
    expect(classifyError({ code: "23505", message: "duplicate key" })).toBe("permanent");
    expect(classifyError({ code: "23514", message: "check constraint" })).toBe("permanent");
    expect(classifyError({ code: "42501", message: "row-level security" })).toBe("permanent");
    expect(classifyError({ code: "PGRST102", message: "bad body" })).toBe("permanent");
    expect(classifyError({ status: 403, message: "forbidden" })).toBe("permanent");
  });
  it("treats everything else as transient", () => {
    expect(classifyError({ status: 500, message: "boom" })).toBe("transient");
    expect(classifyError({ code: "PGRST301", message: "JWT expired" })).toBe("transient");
    expect(classifyError(undefined)).toBe("transient");
  });
  it("formats messages with codes", () => {
    expect(errorMessage({ code: "23505", message: "dup" })).toBe("23505: dup");
    expect(errorMessage(new Error("x"))).toBe("x");
  });
});

describe("drainQueue", () => {
  it("applies pending ops in order and removes each only after success", async () => {
    const q = makeQueue(["a", "b", "c"]);
    const applied: string[] = [];
    const result = await drainQueue({
      ...q.deps,
      apply: async (m) => {
        applied.push(m.id);
        // Only removed after resolution: still in the queue while in flight.
        expect(q.deps.pending().map((x) => x.id)).toContain(m.id);
      },
    });
    expect(applied).toEqual(["a", "b", "c"]);
    expect(q.items()).toHaveLength(0);
    expect(result).toEqual({
      applied: 3,
      quarantined: 0,
      stoppedOffline: false,
      transientFailures: 0,
    });
  });

  it("stops at a network failure, keeps the op pending and does not burn its retry budget", async () => {
    const q = makeQueue(["a", "b"]);
    const apply = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await drainQueue({ ...q.deps, apply });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(result.stoppedOffline).toBe(true);
    expect(q.items().map((m) => [m.id, m.retryCount])).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });

  it("does not even try when the browser reports offline", async () => {
    const q = makeQueue(["a"]);
    const apply = vi.fn(async () => {});
    const result = await drainQueue({ ...q.deps, apply, isOnline: () => false });
    expect(apply).not.toHaveBeenCalled();
    expect(result.stoppedOffline).toBe(true);
    expect(q.items()).toHaveLength(1);
  });

  it("quarantines a permanently rejected op and continues with the rest", async () => {
    const q = makeQueue(["bad", "good"]);
    const result = await drainQueue({
      ...q.deps,
      apply: async (m) => {
        if (m.id === "bad") throw { code: "23514", message: "violates check constraint" };
      },
    });
    expect(result.quarantined).toBe(1);
    expect(result.applied).toBe(1);
    const left = q.items();
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe("bad");
    expect(left[0].quarantined).toBe(true);
    expect(left[0].lastError).toContain("23514");
  });

  it("counts a transient failure, stops to preserve order, and quarantines after the budget", async () => {
    const q = makeQueue(["a", "b"]);
    const apply = async (m: QueuedOperation) => {
      if (m.id === "a") throw { status: 500, message: "server hiccup" };
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      const r = await drainQueue({ ...q.deps, apply, maxRetries: 3 });
      expect(r.transientFailures).toBe(1);
      expect(r.applied).toBe(0); // b waits behind a: order preserved
      expect(q.items()[0].retryCount).toBe(attempt);
    }
    const r3 = await drainQueue({ ...q.deps, apply, maxRetries: 3 });
    expect(q.items().find((m) => m.id === "a")?.quarantined).toBe(true);
    // After a is quarantined the loop moved on and applied b.
    expect(r3.applied).toBe(1);
    expect(q.items().map((m) => m.id)).toEqual(["a"]);
  });

  it("applies each op exactly once even when re-run (idempotent replay)", async () => {
    const q = makeQueue(["a"]);
    const apply = vi.fn(async () => {});
    await drainQueue({ ...q.deps, apply });
    await drainQueue({ ...q.deps, apply });
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
