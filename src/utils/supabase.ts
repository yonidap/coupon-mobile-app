type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

const missingRelationCodes = new Set(['42P01', 'PGRST205']);

export function isMissingRelationError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  if (error.code && missingRelationCodes.has(error.code)) {
    return true;
  }

  return error.message?.toLowerCase().includes('does not exist') ?? false;
}

export function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error(fallbackMessage);
}