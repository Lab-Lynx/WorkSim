const INVALID_DATE = '—';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

function getDateParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    dateFormatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
}

function getDateTimeParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    dateTimeFormatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string | null | undefined): string {
  const date = parseDate(iso);
  if (!date) return INVALID_DATE;

  const { day, month, year } = getDateParts(date);
  return `${day} ${month} ${year}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parseDate(iso);
  if (!date) return INVALID_DATE;

  const { day, month, year, hour, minute } = getDateTimeParts(date);
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

export function formatAmount(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

export function formatScore(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(value);
}