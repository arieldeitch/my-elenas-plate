import { describe, it, expect, beforeEach } from "vitest";
import { all, clear, enqueue, markFailure, pending, quarantine, remove, size } from "./queue";
import type { QueuedMutation } from "./queue";

function mut(id: string): QueuedMutation {
  return {
    id,
    type: "insert",
    entity: "food_entries",
    payload: {},
    householdId: "h1",
    createdAt: "2026-07-23T00:00:00Z",
    retryCount: 0,
  };
}

describe("offline mutation queue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clear();
  });

  it("enqueues and deduplicates by id", () => {
    enqueue(mut("a"));
    enqueue(mut("a"));
    enqueue(mut("b"));
    expect(size()).toBe(2);
  });

  it("removes by id", () => {
    enqueue(mut("a"));
    enqueue(mut("b"));
    remove("a");
    expect(all().map((m) => m.id)).toEqual(["b"]);
  });

  it("quarantines after max retries and excludes from pending", () => {
    enqueue(mut("a"));
    for (let i = 0; i < 5; i++) markFailure("a", "boom", 5);
    expect(all()[0].retryCount).toBe(5);
    expect(all()[0].quarantined).toBe(true);
    expect(pending()).toHaveLength(0);
  });

  it("quarantines immediately on a permanent error", () => {
    enqueue(mut("a"));
    quarantine("a", "constraint violation");
    expect(pending()).toHaveLength(0);
    expect(all()[0].lastError).toContain("constraint");
  });
});
