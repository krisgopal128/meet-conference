import logger from './logger';
/**
 * Camera Capabilities Utility
 * Detects actual camera hardware capabilities and calculates optimal capture settings
 */

export interface CameraCapabilities {
  deviceId: string;
  label: string;
  maxWidth: number;
  maxHeight: number;
  minWidth: number;
  minHeight: number;
  nativeAspectRatio: number;
  supportedAspectRatios?: { min: number; max: number };
  frameRates: { min: number; max: number };
}

/**
 * Get capabilities for a specific camera
 */
export async function getCameraCapabilities(deviceId?: string): Promise<CameraCapabilities | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    logger.warn('getUserMedia not supported — cannot detect camera capabilities');
    return null;
  }

  const constraints: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: 'user' };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
  } catch (err) {
    logger.error('Failed to get camera capabilities:', err);
    return null;
  }

  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return null;

    const capabilities = track.getCapabilities();
    const settings = track.getSettings();

    const result: CameraCapabilities = {
      deviceId: settings.deviceId || deviceId || 'unknown',
      label: track.label || 'Unknown Camera',
      maxWidth: capabilities.width?.max || settings.width || 1280,
      maxHeight: capabilities.height?.max || settings.height || 720,
      minWidth: capabilities.width?.min || 160,
      minHeight: capabilities.height?.min || 120,
      nativeAspectRatio: (capabilities.width?.max || settings.width || 1280) /
                         (capabilities.height?.max || settings.height || 720),
      supportedAspectRatios: capabilities.aspectRatio
        ? { min: capabilities.aspectRatio.min ?? 0, max: capabilities.aspectRatio.max ?? 10 }
        : undefined,
      frameRates: {
        min: capabilities.frameRate?.min || 1,
        max: capabilities.frameRate?.max || 30,
      },
    };

    return result;
  } catch (err) {
    logger.error('Failed to get camera capabilities:', err);
    return null;
  } finally {
    // Always stop ALL tracks to prevent MediaStream leaks
    stream.getTracks().forEach(t => t.stop());
  }
}

/**
 * Log camera capabilities to console for debugging
 */
export function logCameraInfo(capabilities: CameraCapabilities): void {
  logger.info('📷 Camera:', capabilities.label);
  logger.info('   Native Resolution:', `${capabilities.maxWidth}×${capabilities.maxHeight}`);
  logger.info('   Native Aspect Ratio:', capabilities.nativeAspectRatio.toFixed(3));
  logger.info('   Frame Rates:', `${capabilities.frameRates.min}-${capabilities.frameRates.max} fps`);
}
