// Single source of truth for the bundled app version.
// Bumped manually with each release.
//
// data/version.json should mirror this so the "latest version" check
// (which fetches data/version.json with cache-busting) returns the same
// number once the deploy lands.

export const APP_VERSION = '1.3.9';
export const APP_BUILD   = '2026-04-28';
