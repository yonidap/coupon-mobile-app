export function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatCurrency(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) {
    return 'No monetary value';
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

export function getTodayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getDaysUntilDate(value: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(value);
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}