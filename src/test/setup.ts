import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

// Enables `expect(await axe(container)).toHaveNoViolations()` in a11y tests.
expect.extend(matchers);
