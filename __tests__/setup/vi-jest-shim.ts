// vi-jest-shim: map vi to jest when using Jest; under Vitest, vi already exists.
declare const global: any;
try {
  const g = global;
  // If running under Vitest, vi exists; leave as-is.
  // If running under Jest, map jest to vi.
  if (!('vi' in g) && 'jest' in g) {
    g.vi = g.jest;
  }
} catch {}
export {};