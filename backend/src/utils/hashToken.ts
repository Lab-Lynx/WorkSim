import { createHash } from 'crypto';

// One-way hash for storing refresh tokens in the DB. We never store the raw
// token — only this hash — so a database leak alone can't be used to log in
// as anyone. SHA-256 is fine here (not bcrypt): this isn't a low-entropy
// human password, it's a long random JWT, so a fast hash with no salt is
// safe and lets us look it up by exact match on refresh.
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
