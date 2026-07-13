/**
 * Minimal ambient typing for the sim CLI's Node surface (`run.ts` only).
 * Deliberately NOT `@types/node`: pulling full node globals into the
 * package's typecheck would let effectful code typecheck inside `src/`,
 * weakening AD-1's isolation (the purity regex guard would still catch it,
 * but the type layer should agree). `sim/` runs under tsx on Node 24.
 */
declare const process: {
  readonly argv: string[];
  exit(code?: number): never;
};
