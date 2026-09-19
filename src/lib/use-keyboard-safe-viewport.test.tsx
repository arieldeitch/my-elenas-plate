import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboardSafeViewport } from "./use-keyboard-safe-viewport";

function Harness() { useKeyboardSafeViewport(); return <input aria-label="כמות" />; }

describe("useKeyboardSafeViewport", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--app-viewport-height");
    document.documentElement.style.removeProperty("--app-viewport-top");
  });

  it("anchors immediately and uses nearest auto correction only when obscured", () => {
    const listeners = new Map<string, EventListener>();
    const viewport = { height: 420, offsetTop: 12, addEventListener: vi.fn((name: string, fn: EventListener) => listeners.set(name, fn)), removeEventListener: vi.fn() };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const reveal = vi.fn();
    HTMLElement.prototype.scrollIntoView = reveal;
    const { getByLabelText } = render(<Harness />);
    const input = getByLabelText("כמות");
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({ top: 400, bottom: 450 } as DOMRect);
    input.focus();
    act(() => listeners.get("resize")?.(new Event("resize")));
    expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("420px");
    expect(document.documentElement.style.getPropertyValue("--app-viewport-top")).toBe("12px");
    expect(reveal).toHaveBeenCalledWith({ block: "nearest", inline: "nearest", behavior: "auto" });
  });

  it("does not correct a visible focused field or schedule delayed work", () => {
    vi.useFakeTimers();
    const listeners = new Map<string, EventListener>();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: { height: 420, offsetTop: 0, addEventListener: (name: string, fn: EventListener) => listeners.set(name, fn), removeEventListener: vi.fn() } });
    const reveal = vi.fn(); HTMLElement.prototype.scrollIntoView = reveal;
    const { getByLabelText } = render(<Harness />);
    const input = getByLabelText("כמות");
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({ top: 80, bottom: 120 } as DOMRect);
    input.focus(); act(() => listeners.get("resize")?.(new Event("resize")));
    expect(reveal).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
