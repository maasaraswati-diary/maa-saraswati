import crypto from 'node:crypto';

/** Short, collision-resistant id with a readable prefix. */
export function newId(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function nowIso() {
  return new Date().toISOString();
}
