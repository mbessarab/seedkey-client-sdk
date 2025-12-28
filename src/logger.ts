/**
 * Debug Logger
 */

// Global flag for controlling debug mode
let debugEnabled = false;

// Check debug mode
function isDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return debugEnabled || localStorage.getItem('seedkey_debug') === 'true';
  }
  return debugEnabled;
}

/**
 * Enable debug logging
 */
export function enableDebug(): void {
  debugEnabled = true;
  if (typeof window !== 'undefined') {
    localStorage.setItem('seedkey_debug', 'true');
  }
}

/**
 * Disable debug logging
 */
export function disableDebug(): void {
  debugEnabled = false;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('seedkey_debug');
  }
}

// Colors for different modules
const MODULE_COLORS: Record<string, string> = {
  'SDK': '#10b981',      // emerald
  'Auth': '#8b5cf6',     // violet  
  'API': '#3b82f6',      // blue
  'Storage': '#f59e0b',  // amber
  'UI': '#ec4899',       // pink
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Create a module logger
 */
export function createLogger(module: string) {
  const color = MODULE_COLORS[module] || '#64748b';
  
  const formatPrefix = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return [`%c[${module}]%c ${time}.${ms}`, `color: ${color}; font-weight: bold`, 'color: #64748b'];
  };

  const log = (level: LogLevel, message: string, data?: unknown) => {
    if (!isDebugEnabled()) return;
    
    const [prefix, ...styles] = formatPrefix();
    const fullMessage = `${prefix} ${message}`;
    
    const logFn = level === 'error' ? console.error 
      : level === 'warn' ? console.warn 
      : level === 'debug' ? console.debug 
      : console.log;
    
    if (data !== undefined) {
      logFn(fullMessage, ...styles, data);
    } else {
      logFn(fullMessage, ...styles);
    }
  };

  return {
    debug: (message: string, data?: unknown) => log('debug', message, data),
    
    info: (message: string, data?: unknown) => log('info', message, data),
    
    warn: (message: string, data?: unknown) => log('warn', message, data),
    
    error: (message: string, data?: unknown) => log('error', message, data),
    
    /** Log grouping */
    group: (label: string, collapsed = true) => {
      if (!isDebugEnabled()) return;
      const [prefix, ...styles] = formatPrefix();
      if (collapsed) {
        console.groupCollapsed(`${prefix} ${label}`, ...styles);
      } else {
        console.group(`${prefix} ${label}`, ...styles);
      }
    },
    
    /** End group */
    groupEnd: () => {
      if (!isDebugEnabled()) return;
      console.groupEnd();
    },

    /** Data table */
    table: (data: unknown) => {
      if (!isDebugEnabled()) return;
      console.table(data);
    },

    /** Timing */
    time: (label: string) => {
      if (!isDebugEnabled()) return;
      console.time(`[${module}] ${label}`);
    },

    /** End timing */
    timeEnd: (label: string) => {
      if (!isDebugEnabled()) return;
      console.timeEnd(`[${module}] ${label}`);
    },
  };
}

// Pre-created loggers for modules
export const sdkLogger = createLogger('SDK');
export const authLogger = createLogger('Auth');
export const apiLogger = createLogger('API');
export const storageLogger = createLogger('Storage');
export const uiLogger = createLogger('UI');

// Global functions to enable/disable debug in browser console
if (typeof window !== 'undefined') {
  (window as unknown as { enableSeedKeyDebug: () => void }).enableSeedKeyDebug = () => {
    enableDebug();
    console.log('🔓 SeedKey debug mode enabled. Reload the page.');
  };
  
  (window as unknown as { disableSeedKeyDebug: () => void }).disableSeedKeyDebug = () => {
    disableDebug();
    console.log('🔒 SeedKey debug mode disabled. Reload the page.');
  };
}
