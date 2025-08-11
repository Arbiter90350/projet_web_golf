import axios, { type AxiosError } from 'axios';

// Normalise les messages d'erreur venant d'Axios / API
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<unknown>;
    // Priorité au message serveur structuré
    const anyData = axErr.response?.data as Record<string, unknown> | undefined;
    const message = (anyData?.message as string | undefined)
      || (anyData?.error as string | undefined)
      || axErr.message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  // Fallback générique sans divulguer de détails sensibles
  return 'Une erreur est survenue. Veuillez réessayer.';
}
