import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { DeviceProfileChooser } from "./DeviceProfileChooser";
import { ProfileSwitcher } from "./ProfileSwitcher";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

describe("DeviceProfileChooser (Test 7 — device default profile)", () => {
  beforeEach(() => window.localStorage.clear());

  it("asks explicitly on a fresh device and cannot be dismissed without choosing", () => {
    render(<DeviceProfileChooser />, { wrapper });
    expect(screen.getByRole("dialog", { name: "מי משתמש/ת במכשיר הזה?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ביטול" })).toBeNull();
  });

  it("choosing אלנה stores the device preference and activates her profile", async () => {
    render(
      <>
        <ProfileSwitcher />
        <DeviceProfileChooser />
      </>,
      { wrapper },
    );
    await userEvent.click(screen.getByRole("button", { name: /אלנה/ }));
    expect(window.localStorage.getItem(DEVICE_PROFILE_KEY)).toBe("elena");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("tab", { name: /אלנה/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("device-profile-default")).toHaveTextContent(
      "ברירת מחדל במכשיר הזה: אלנה",
    );
  });

  it("does not show on a device that already chose, and can be re-opened from the switcher", async () => {
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "elena");
    render(
      <>
        <ProfileSwitcher />
        <DeviceProfileChooser />
      </>,
      { wrapper },
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("tab", { name: /אלנה/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByTestId("device-profile-default"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ביטול" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
