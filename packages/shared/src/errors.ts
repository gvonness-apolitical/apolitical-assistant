/**
 * Error Handling Utilities
 *
 * Provides consistent error normalization across the codebase.
 */

/**
 * Converts an unknown error to an Error instance.
 *
 * Use this when you need to ensure you have an Error object,
 * such as when rethrowing or storing errors in a collection.
 *
 * @param err - The unknown error value
 * @returns An Error instance
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   errors.push(toError(err));
 * }
 * ```
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}

/**
 * Extracts the error message from an unknown error.
 *
 * Use this when you only need the error message string,
 * such as for logging or user-facing error messages.
 *
 * @param err - The unknown error value
 * @returns The error message string
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   console.error('Failed:', toErrorMessage(err));
 * }
 * ```
 */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Type guard to check if a value is an Error instance.
 *
 * @param value - The value to check
 * @returns True if the value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
