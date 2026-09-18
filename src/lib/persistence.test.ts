import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// DEC-024: localStorage persistence must refuse to write when the build is a
// shared (cloud-required) build that has no Supabase configuration.
const state = vi.hoisted(() => ({ misconfigured: false }));
vi.mock("./build-info", () => ({
  getBuildInfo: () => ({ misconfigured: state.misconfigured }),
}));

import { saveState, loadState, clearState, type PersistedState } from "./persistence";

const sample: Omit<PersistedState, "version"> = {
  activeProfile: "me",
  days: { me: {}, elena: {} },
  weighIns: { me: [], elena: [] },
  favorites: { me: [], elena: [] },
  recents: { me: [], elena: [] },
  foods: [],
};

beforeEach(() => {
  window.localStorage.clear();
  state.misconfigured = false;
});
afterEach(() => vi.restoreAllMocks());

describe("persistence (demo-mode localStorage)", () => {
  it("round-trips state in a deliberate demo build", () => {
    saveState(sample);
    expect(loadState()?.activeProfile).toBe("me");
    clearState();
    expect(loadState()).toBeNull();
  });

  it("refuses to write when a shared build has no Supabase configuration", () => {
    state.misconfigured = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    saveState(sample);
    expect(window.localStorage.getItem("elenas-plate:v1")).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("refusing localStorage write"));
  });
});
