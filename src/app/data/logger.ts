import { environment } from 'src/environments/environment';

/**
 * Thin console wrapper that stays silent in production builds. Use this instead of
 * calling `console.*` directly so diagnostic output never reaches end users.
 */
export const logger = {
  log: (...args: unknown[]): void => {
    if (!environment.production) { console.log(...args); }
  },
  warn: (...args: unknown[]): void => {
    if (!environment.production) { console.warn(...args); }
  },
  error: (...args: unknown[]): void => {
    if (!environment.production) { console.error(...args); }
  },
};
