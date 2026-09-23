/** Public User object from Doc 5 §5.3.0 — never includes passwordHash. */
export type SerializedUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type SerializeUserInput = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export const serializeUser = (user: SerializeUserInput): SerializedUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  createdAt: user.createdAt.toISOString(),
});
