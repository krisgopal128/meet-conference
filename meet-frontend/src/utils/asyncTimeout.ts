/**
 * Shared utility for wrapping async operations with timeout protection.
 * Prevents indefinite hangs from API calls, device operations, etc.
 */

import logger from './logger';

export const OPERATION_TIMEOUTS = {
  // Media operations (camera, mic toggle)
  MEDIA_TOGGLE: 5000,
  // Screen share requires user interaction with browser picker dialog
  SCREEN_SHARE: 60000,
  // Device operations (switch active device)
  DEVICE_SWITCH: 8000,
  // Disconnect from room
  DISCONNECT: 5000,
  // Publishing data via DataChannel
  PUBLISH_DATA: 3000,
  // General API calls
  API_CALL: 10000,
  // Recording operations
  RECORDING: 10000,
  // Settings operations
  SETTINGS: 8000,
} as const;

export type OperationType = keyof typeof OPERATION_TIMEOUTS;

/**
 * Wrap a promise with a timeout.
 * If the promise doesn't resolve/reject within the timeout, it rejects with a timeout error.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Human-readable name for logging
 * @returns Promise that rejects if timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        const error = new Error(`${operationName} timeout after ${timeoutMs}ms`);
        logger.warn(`[AsyncTimeout] ${operationName} exceeded ${timeoutMs}ms timeout`);
        reject(error);
      }, timeoutMs)
    ),
  ]);
}

/**
 * Wrap a promise with a timeout using predefined operation type.
 * Automatically selects the timeout duration based on operation type.
 *
 * @param promise - The promise to wrap
 * @param operationType - Type of operation (key from OPERATION_TIMEOUTS)
 * @param operationName - Human-readable name for logging
 * @returns Promise that rejects if timeout is exceeded
 */
export function withOperationTimeout<T>(
  promise: Promise<T>,
  operationType: OperationType,
  operationName: string,
): Promise<T> {
  const timeoutMs = OPERATION_TIMEOUTS[operationType];
  return withTimeout(promise, timeoutMs, operationName);
}

/**
 * Wrapper for handling timeouts gracefully with logging and optional fallback.
 * Useful when you want to log the error but not necessarily fail the entire operation.
 */
export async function withTimeoutAndFallback<T>(
  promise: Promise<T>,
  operationType: OperationType,
  operationName: string,
  fallback?: T,
): Promise<T | undefined> {
  try {
    return await withOperationTimeout(promise, operationType, operationName);
  } catch (err) {
    logger.error(`[AsyncTimeout] ${operationName} failed:`, err);
    return fallback;
  }
}
