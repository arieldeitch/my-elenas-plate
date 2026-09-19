import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyboardSafety } from "@/components/KeyboardSafety";

describe("keyboard-safe viewport", () => {
  it("tracks a constrained visual viewport and reveals the focused input", () => {
    vi.useFakeTimers();
    const listeners = new Map<string, EventListener>();
    const viewport = {
      height: 420,
      addEventListener: vi.fn((name: string, fn: EventListener) => listeners.set(name, fn)),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const reveal = vi.fn();
    HTMLElement.prototype.scrollIntoView = reveal;
    const { getByLabelText } = render(
      <>
        <KeyboardSafety />
        <label>
          צעדים
          <input aria-label="צעדים" />
        </label>
      </>,
    );
    getByLabelText("צעדים").focus();
    act(() => {
      listeners.get("resize")?.(new Event("resize"));
      vi.advanceTimersByTime(100);
    });
    expect(document.documentElement.style.getPropertyValue("--visual-viewport-height")).toBe("420px");
    expect(reveal).toHaveBeenCalled();
    vi.useRealTimers();
  });
});