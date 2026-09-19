import "@testing-library/jest-dom/vitest";
import { expect, vi } from "vitest";
import * as matchers from "vitest-axe/matchers";

// Enables `expect(await axe(container)).toHaveNoViolations()` in a11y tests.
expect.extend(matchers);

// Keep the unit/integration suite hermetic (local demo mode) regardless of a
// local .env: force Supabase to look unconfigured. The live RLS integration
// test uses separate SUPABASE_TEST_* process env, so it is unaffected.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
