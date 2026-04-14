const isDev = import.meta.env.DEV;

const logger = {
  debug: (...args: unknown[]) => isDev && console.debug('[DEBUG]', ...args),
  info: (...args: unknown[]) => isDev && console.info('[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
};

export default logger;
