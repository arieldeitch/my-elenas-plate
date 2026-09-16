import { describe, it, expect } from "vitest";
import {
  coalesceKey,
  dayKeyOf,
  opsForAddEntry,
  opsForRemoveEntry,
  opsForSetFasting,
  opsForSetMealSkipped,
  opsForSetWorkout,
  opsForUpdateEntry,
  touchesProfile,
} from "./operations";
import type { FoodEntry } from "../domain";

const ctx = { profile: "elena" as const, iso: "2026-09-16" };
const apple: FoodEntry = {
  id: "e-1",
  foodId: "f_apple",
  foodName: "תפוח",
  mode: "measured",
  amount: 1,
  unit: "יחידה",
};

describe("store edits → narrow operations", () => {
  it("adding an entry upserts that entry and marks only its slot logged", () => {
    expect(opsForAddEntry(ctx, "lunch", apple)).toEqual([
      { kind: "entry.upsert", ...ctx, slot: "lunch", entry: apple },
      { kind: "status.set", ...ctx, slot: "lunch", status: "logged" },
    ]);
  });

  it("updating an entry touches only that entry", () => {
    expect(opsForUpdateEntry(ctx, "lunch", apple)).toEqual([
      { kind: "entry.upsert", ...ctx, slot: "lunch", entry: apple },
    ]);
  });

  it("removing an entry deletes only that id; status resets only when the meal emptied", () => {
    expect(opsForRemoveEntry(ctx, "lunch", "e-1", 2, "logged")).toEqual([
      { kind: "entry.delete", ...ctx, slot: "lunch", entryId: "e-1" },
    ]);
    expect(opsForRemoveEntry(ctx, "lunch", "e-1", 0, "logged")).toEqual([
      { kind: "entry.delete", ...ctx, slot: "lunch", entryId: "e-1" },
      { kind: "status.set", ...ctx, slot: "lunch", status: "empty" },
    ]);
    // A skipped meal stays skipped.
    expect(opsForRemoveEntry(ctx, "lunch", "e-1", 0, "skipped")).toHaveLength(1);
  });

  it("skipping deletes only the entries this device can see, then marks skipped", () => {
    expect(opsForSetMealSkipped(ctx, "late", true, ["a", "b"])).toEqual([
      { kind: "entry.delete", ...ctx, slot: "late", entryId: "a" },
      { kind: "entry.delete", ...ctx, slot: "late", entryId: "b" },
      { kind: "status.set", ...ctx, slot: "late", status: "skipped" },
    ]);
    expect(opsForSetMealSkipped(ctx, "late", false, [])).toEqual([
      { kind: "status.set", ...ctx, slot: "late", status: "empty" },
    ]);
    expect(opsForSetMealSkipped(ctx, "late", false, ["a"])).toEqual([
      { kind: "status.set", ...ctx, slot: "late", status: "logged" },
    ]);
  });

  it("fasting / workout have explicit set and clear operations", () => {
    expect(opsForSetFasting(ctx, { start: "20:00", end: "12:00" })).toEqual([
      { kind: "fasting.set", ...ctx, fasting: { start: "20:00", end: "12:00" } },
    ]);
    expect(opsForSetFasting(ctx, undefined)).toEqual([{ kind: "fasting.clear", ...ctx }]);
    expect(opsForSetWorkout(ctx, { performed: false })).toEqual([
      { kind: "workout.set", ...ctx, workout: { performed: false } },
    ]);
    expect(opsForSetWorkout(ctx, undefined)).toEqual([{ kind: "workout.clear", ...ctx }]);
  });

  it("coalesce keys name exactly one row; day keys name the affected day", () => {
    const [up, st] = opsForAddEntry(ctx, "lunch", apple);
    expect(coalesceKey(up)).toBe("entry:e-1");
    expect(coalesceKey(st)).toBe("status:elena:2026-09-16:lunch");
    expect(coalesceKey({ kind: "entry.delete", ...ctx, slot: "lunch", entryId: "e-1" })).toBe(
      "entry:e-1",
    );
    expect(coalesceKey(opsForSetFasting(ctx, undefined)[0])).toBe("fasting:elena:2026-09-16");
    expect(dayKeyOf(up)).toBe("elena::2026-09-16");
    expect(dayKeyOf({ kind: "food.upsert", food: { id: "x", name: "x" } })).toBeNull();
    expect(touchesProfile(up, "elena")).toBe(true);
    expect(touchesProfile(up, "me")).toBe(false);
  });
});
