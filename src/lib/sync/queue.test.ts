import { describe, it, expect, beforeEach } from "vitest";
import {
  QUEUE_KEY,
  all,
  clear,
  discardQuarantined,
  enqueue,
  enqueueOperation,
  hasPendingForProfile,
  markFailure,
  ownedBy,
  pending,
  pendingDayKeys,
  quarantine,
  quarantined,
  remove,
  retryQuarantined,
  setQueueOwner,
  size,
  toQueued,
} from "./queue";
import type { Operation, QueuedOperation } from "./operations";

const entry = (id: string): Operation => ({
  kind: "entry.upsert",
  profile: "me",
  iso: "2026-09-16",
  slot: "lunch",
  entry: { id, foodId: "f_apple", foodName: "תפוח", mode: "measured", amount: 1, unit: "יחידה" },
});

function mut(id: string, op: Operation = entry(id)): QueuedOperation {
  return { ...toQueued(op), id };
}

describe("durable operation queue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setQueueOwner(undefined);
    clear();
  });

  it("enqueues and deduplicates by mutation id", () => {
    enqueue(mut("a"));
    enqueue(mut("a"));
    enqueue(mut("b"));
    expect(size()).toBe(2);
  });

  it("survives a reload: the queue is read back from localStorage", () => {
    enqueueOperation(entry("e1"));
    const raw = window.localStorage.getItem(QUEUE_KEY);
    expect(raw).toBeTruthy();
    // A fresh page has no module state — everything comes from storage.
    const parsed = JSON.parse(raw!) as QueuedOperation[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].op.kind).toBe("entry.upsert");
    expect(pending().map((m) => m.op)).toEqual([entry("e1")]);
  });

  it("stores operations, never day snapshots", () => {
    enqueueOperation(entry("e1"));
    const [m] = all();
    expect(m.op).not.toHaveProperty("meals");
    expect(Object.keys(m.op)).toEqual(["kind", "profile", "iso", "slot", "entry"]);
  });

  it("coalesces two edits of the same row in place, preserving order", () => {
    enqueueOperation(entry("e1"));
    enqueueOperation(entry("e2"));
    const first = entry("e1") as Extract<Operation, { kind: "entry.upsert" }>;
    const edited: Operation = { ...first, entry: { ...first.entry, amount: 3 } };
    enqueueOperation(edited);
    const ops = pending().map((m) => m.op);
    expect(ops).toHaveLength(2);
    expect(ops[0]).toEqual(edited); // still first, but with the newest value
    expect(ops[1]).toEqual(entry("e2"));
  });

  it("set-then-clear of the same fasting record keeps only the clear", () => {
    enqueueOperation({
      kind: "fasting.set",
      profile: "me",
      iso: "2026-09-16",
      fasting: { start: "20:00", end: "12:00" },
    });
    enqueueOperation({ kind: "fasting.clear", profile: "me", iso: "2026-09-16" });
    expect(pending().map((m) => m.op.kind)).toEqual(["fasting.clear"]);
  });

  it("delete-then-restore (undo) of one entry ends as an upsert", () => {
    enqueueOperation({
      kind: "entry.delete",
      profile: "me",
      iso: "2026-09-16",
      slot: "lunch",
      entryId: "e1",
    });
    enqueueOperation(entry("e1"));
    expect(pending().map((m) => m.op.kind)).toEqual(["entry.upsert"]);
  });

  it("removes by id", () => {
    enqueue(mut("a"));
    enqueue(mut("b", entry("b")));
    remove("a");
    expect(all().map((m) => m.id)).toEqual(["b"]);
  });

  it("quarantines after max retries and excludes from pending", () => {
    enqueue(mut("a"));
    for (let i = 0; i < 5; i++) markFailure("a", "boom", 5);
    expect(all()[0].retryCount).toBe(5);
    expect(all()[0].quarantined).toBe(true);
    expect(pending()).toHaveLength(0);
    expect(quarantined()).toHaveLength(1);
  });

  it("quarantines immediately on a permanent error and stays visible", () => {
    enqueue(mut("a"));
    quarantine("a", "constraint violation");
    expect(pending()).toHaveLength(0);
    expect(quarantined()[0].lastError).toContain("constraint");
    // Nothing disappears silently: a person retries or discards.
    expect(retryQuarantined()).toBe(1);
    expect(pending()).toHaveLength(1);
    expect(all()[0].retryCount).toBe(0);
    quarantine("a", "again");
    expect(discardQuarantined()).toBe(1);
    expect(size()).toBe(0);
  });

  it("reports which days and profiles still have unsent ops", () => {
    enqueueOperation(entry("e1"));
    enqueueOperation({
      kind: "weighin.insert",
      profile: "elena",
      weighIn: { id: "w1", dateISO: "2026-09-16", weightKg: 60 },
    });
    expect([...pendingDayKeys()]).toEqual(["me::2026-09-16"]);
    expect(hasPendingForProfile("me")).toBe(true);
    expect(hasPendingForProfile("elena", new Set(["weighin.insert"]))).toBe(true);
    expect(hasPendingForProfile("elena", new Set(["entry.upsert"]))).toBe(false);
  });

  it("stamps the signed-in owner and refuses to apply under another user", () => {
    setQueueOwner("user-A");
    const m = enqueueOperation(entry("e1"));
    expect(m.owner).toBe("user-A");
    expect(ownedBy(m, "user-A")).toBe(true);
    expect(ownedBy(m, "user-B")).toBe(false);
    // Ops created before the session was known apply to whoever signs in.
    setQueueOwner(undefined);
    const anon = enqueueOperation(entry("e2"));
    expect(anon.owner).toBeUndefined();
    expect(ownedBy(anon, "user-B")).toBe(true);
  });
});
