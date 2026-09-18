/**
 * Non-secret release constants for the shared couple app. Everything here is
 * already public (the project ref appears in every served bundle; the URL is
 * the published site). NEVER put keys here.
 */
export const PRODUCTION_SUPABASE_REF = "rqgoiuztphkcvbwtbxbj";
export const PRODUCTION_SUPABASE_HOST = `${PRODUCTION_SUPABASE_REF}.supabase.co`;
export const PRODUCTION_URL = "https://my-elenas-plate.lovable.app";
/** The isolated hosted test branch (M1). Also non-production, also non-secret. */
export const TEST_BRANCH_SUPABASE_REF = "uyroeumwmjhrcbkesmgb";
