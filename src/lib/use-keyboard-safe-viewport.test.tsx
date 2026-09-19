import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboardSafeViewport } from "./use-keyboard-safe-viewport";

function Harness() {
  useKeyboardSafeViewport();
  return <input aria-label="מספר צעדים" />;
}

describe("useKeyboardSafeViewport", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.removeProperty("--app-viewport-height");
  });

  it("tracks a keyboard-sized visual viewport and reveals the focused field", () => {
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

    const { getByLabelText } = render(<Harness />);
    getByLabelText("מספר צעדים").focus();
    act(() => {
      listeners.get("resize")?.(new Event("resize"));
      vi.runOnlyPendingTimers();
    });

    expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("420px");
    expect(reveal).toHaveBeenCalled();
  });
});
