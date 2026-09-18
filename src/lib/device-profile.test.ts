import { describe, it, expect, beforeEach } from "vitest";
import {
  DEVICE_PROFILE_KEY,
  clearDeviceProfile,
  isProfileId,
  loadDeviceProfile,
  saveDeviceProfile,
} from "./device-profile";

describe("device profile preference", () => {
  beforeEach(() => window.localStorage.clear());

  it("is unset on a fresh device", () => {
    expect(loadDeviceProfile()).toBeNull();
  });

  it("round-trips a choice through localStorage", () => {
    saveDeviceProfile("elena");
    expect(loadDeviceProfile()).toBe("elena");
    expect(window.localStorage.getItem(DEVICE_PROFILE_KEY)).toBe("elena");
    clearDeviceProfile();
    expect(loadDeviceProfile()).toBeNull();
  });

  it("ignores corrupt or unknown values instead of guessing", () => {
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "someone-else");
    expect(loadDeviceProfile()).toBeNull();
    expect(isProfileId("me")).toBe(true);
    expect(isProfileId("")).toBe(false);
    expect(isProfileId(42)).toBe(false);
  });

  it("stores only the preference — never nutrition data", () => {
    saveDeviceProfile("me");
    // The whole value is a two-character enum; nothing else is written.
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem(DEVICE_PROFILE_KEY)).toBe("me");
  });
});
