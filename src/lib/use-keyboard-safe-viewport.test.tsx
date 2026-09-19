import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboardSafeViewport } from "./use-keyboard-safe-viewport";

function Harness() {
  useKeyboardSafeViewport();
  return <input aria-label="מספר צעדים" />;
}

describe("useKeyboardSafeViewport", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--app-viewport-height");
    document.documentElement.style.removeProperty("--app-viewport-offset-top");
    delete document.documentElement.dataset.keyboardOpen;
  });

  it("tracks the visual viewport and never smooth-scrolls after the keyboard opens", () => {
    const listeners = new Map<string, EventListener>();
    const viewport = {
      height: 420,
      offsetTop: 0,
      addEventListener: vi.fn((name: string, fn: EventListener) => listeners.set(name, fn)),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const reveal = vi.fn();
    HTMLElement.prototype.scrollIntoView = reveal;

    const { getByLabelText } = render(<Harness />);
    const input = getByLabelText("מספר צעדים");
    fireEvent.pointerDown(input);
    input.focus();
    act(() => listeners.get("resize")?.(new Event("resize")));

    expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("420px");
    expect(reveal).toHaveBeenCalled();
    for (const call of reveal.mock.calls) {
      expect(call[0]).toMatchObject({ behavior: "auto" });
      expect(call[0]).not.toMatchObject({ behavior: "smooth" });
    }
  });

  it("does not move a focused field that is already inside the visible viewport", () => {
    const listeners = new Map<string, EventListener>();
    const viewport = {
      height: 700,
      offsetTop: 0,
      addEventListener: vi.fn((name: string, fn: EventListener) => listeners.set(name, fn)),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const reveal = vi.fn();
    HTMLElement.prototype.scrollIntoView = reveal;
    const rect = {
      top: 120,
      bottom: 165,
      left: 0,
      right: 200,
      width: 200,
      height: 45,
      x: 0,
      y: 120,
      toJSON: () => ({}),
    };

    const { getByLabelText } = render(<Harness />);
    const input = getByLabelText("מספר צעדים");
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue(rect as DOMRect);
    input.focus();
    reveal.mockClear();
    act(() => listeners.get("resize")?.(new Event("resize")));

    expect(reveal).not.toHaveBeenCalled();
  });

  it("a touch on a control in the upper half of the viewport does not move anything before the keyboard", () => {
    const viewport = {
      height: 740,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const reveal = vi.fn();
    HTMLElement.prototype.scrollIntoView = reveal;
    const { getByLabelText } = render(<Harness />);
    const input = getByLabelText("מספר צעדים");
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 148 } as DOMRect);
    fireEvent.pointerDown(input, { pointerType: "touch" });
    expect(reveal).not.toHaveBeenCalled();
  });

  it("a touch on a control in the keyboard zone pre-positions it once, instantly, before focus", () => {
    const viewport = {
      height: 740,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const reveal = vi.fn();
    HTMLElement.prototype.scrollIntoView = reveal;
    const { getByLabelText } = render(<Harness />);
    const input = getByLabelText("מספר צעדים");
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({ top: 600, bottom: 648 } as DOMRect);
    fireEvent.pointerDown(input, { pointerType: "touch" });
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.calls[0][0]).toMatchObject({ block: "center", behavior: "auto" });
  });
});
