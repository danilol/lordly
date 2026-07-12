/**
 * Deterministic 32-bit FNV-1a hash of a plain-JSON value, using a canonical
 * serialization (object keys sorted recursively) so key order can never
 * change the hash. Used by the AD-8 balance-hash guard; pure, no deps.
 * Returns an unsigned 32-bit integer rendered as fixed-length hex.
 *
 * @throws TypeError on anything outside plain JSON (undefined, functions,
 * symbols, NaN/Infinity, class instances like Date/Map, circular references)
 * — silent canonicalization of such values would let two different inputs
 * collide, defeating the guard.
 */
export function contentHash(value: unknown): string {
  const json = canonicalJson(value, new Set());
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Canonical JSON: arrays in order, object keys sorted recursively; strict. */
function canonicalJson(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`non-finite number is not plain JSON: ${value}`);
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('circular structure');
    seen.add(value);
    const body = value.map((v) => canonicalJson(v, seen)).join(',');
    seen.delete(value);
    return `[${body}]`;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError('only plain objects are hashable (no Date/Map/class instances)');
    }
    if (seen.has(value)) throw new TypeError('circular structure');
    seen.add(value);
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const body = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k], seen)}`);
    seen.delete(value);
    return `{${body.join(',')}}`;
  }
  throw new TypeError(`${typeof value} is not plain JSON`);
}
