/**
 * mediaErrors - Human-readable error messages for MediaDevices failures.
 *
 * Maps browser DOMException names to actionable user-facing messages,
 * distinguishing permission denied, device not found, device in use, etc.
 */

export function getMediaErrorMessage(error: unknown, action: string): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return `${action} denied. Check browser permissions.`;
      case 'NotFoundError':
      case 'OverconstrainedError':
        return `No suitable device found for ${action.toLowerCase()}.`;
      case 'NotReadableError':
        return `${action} is in use by another application.`;
      case 'AbortError':
        return `${action} was interrupted. Try again.`;
      default:
        return `${action} failed: ${error.message}`;
    }
  }
  return `${action} failed.`;
}
