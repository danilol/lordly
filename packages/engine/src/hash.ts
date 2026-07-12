/**
 * Deterministic 32-bit FNV-1a hash of a JSON-serializable value, using a
 * canonical serialization (object keys sorted recursively) so key order can
 * never change the hash. Used by the AD-8 balance-hash guard; pure, no deps.
 * Returns an unsigned 32-bit integer rendered as fixed-length hex.
 */
export function contentHash(value: unknown): string {
  const json = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Canonical JSON: arrays in order, object keys sorted recursively. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const body = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
    return `{${body.join(',')}}`;
  }
  return JSON.stringify(value);
}
