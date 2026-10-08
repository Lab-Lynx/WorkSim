/**
 * Builds an ordered, de-duplicated list of API keys to try for one AI operation.
 * Unset or blank entries are skipped, so a deployment with a single key behaves exactly as before.
 */
export const collectApiKeys = (...candidates: Array<string | undefined>): string[] => {
  const keys: string[] = [];
  for (const candidate of candidates) {
    const key = candidate?.trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
};
