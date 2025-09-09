import "../setup/vi-jest-shim";

// Provide global expect/describe/test in environments where not automatically available.
// In Jest and Vitest, these are globals already; this import is a no-op safeguard.
export {};