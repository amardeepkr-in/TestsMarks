import * as Sentry from '@sentry/nextjs';
import { info, error as logError, warn } from './logger';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Initialize Sentry if DSN is provided
const sentryEnabled = !!process.env.SENTRY_DSN;

if (sentryEnabled && typeof window === 'undefined') {
  // Server-side initialization is handled by sentry.server.config.ts
  console.log('Sentry monitoring enabled');
}

export interface EventData {
  [key: string]: unknown;
}

export interface ErrorContext {
  user?: {
    id: number;
    username: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

/**
 * Track a custom event
 */
export function trackEvent(event: string, data?: EventData): void {
  try {
    // Log to Winston
    info(`Event: ${event}`, data);

    // Send to Sentry as breadcrumb
    if (sentryEnabled) {
      Sentry.addBreadcrumb({
        category: 'event',
        message: event,
        data,
        level: 'info',
      });
    }
  } catch (err) {
    console.error('Error tracking event:', err);
  }
}

/**
 * Track an error with context
 */
export function trackError(error: Error, context?: ErrorContext): void {
  try {
    // Log to Winston
    logError(error.message, {
      stack: error.stack,
      ...context,
    });

    // Send to Sentry
    if (sentryEnabled) {
      Sentry.withScope((scope) => {
        // Add user context
        if (context?.user) {
          scope.setUser({
            id: context.user.id.toString(),
            username: context.user.username,
          });
        }

        // Add tags
        if (context?.tags) {
          Object.entries(context.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }

        // Add extra context
        if (context?.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        Sentry.captureException(error);
      });
    }
  } catch (err) {
    console.error('Error tracking error:', err);
  }
}

/**
 * Track a performance metric
 */
export function trackPerformance(metric: PerformanceMetric): void {
  try {
    // Log to Winston
    info(`Performance: ${metric.name}`, {
      value: metric.value,
      unit: metric.unit || 'ms',
      tags: metric.tags,
    });

    // Send to Sentry as measurement
    if (sentryEnabled && Sentry.metrics) {
      try {
        Sentry.metrics.distribution(metric.name, metric.value, {
          unit: metric.unit as string,
        });
      } catch {
        // Metrics API might not be available in all Sentry versions
      }
    }
  } catch (err) {
    console.error('Error tracking performance:', err);
  }
}

/**
 * Track API request performance
 */
export function trackApiRequest(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number
): void {
  trackPerformance({
    name: 'api.request.duration',
    value: duration,
    unit: 'millisecond',
    tags: {
      endpoint,
      method,
      status: statusCode.toString(),
    },
  });
}

/**
 * Track database query performance
 */
export function trackDatabaseQuery(
  query: string,
  duration: number,
  success: boolean
): void {
  trackPerformance({
    name: 'db.query.duration',
    value: duration,
    unit: 'millisecond',
    tags: {
      query: query.substring(0, 50), // Truncate long queries
      success: success.toString(),
    },
  });
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  // Fallback: return a simple timer
  const startTime = Date.now();
  return {
    finish: () => {
      const duration = Date.now() - startTime;
      trackPerformance({
        name,
        value: duration,
        tags: { op },
      });
    },
    setStatus: () => {},
    setTag: () => {},
    setData: () => {},
  };
}

/**
 * Measure function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    trackPerformance({
      name,
      value: duration,
      tags: { success: 'true' },
    });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    trackPerformance({
      name,
      value: duration,
      tags: { success: 'false' },
    });
    throw error;
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: number; username: string } | null): void {
  if (sentryEnabled) {
    if (user) {
      Sentry.setUser({
        id: user.id.toString(),
        username: user.username,
      });
    } else {
      Sentry.setUser(null);
    }
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (sentryEnabled) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  if (sentryEnabled) {
    Sentry.captureMessage(message, level);
  }

  // Also log to Winston
  switch (level) {
    case 'fatal':
    case 'error':
      logError(message);
      break;
    case 'warning':
      warn(message);
      break;
    default:
      info(message);
  }
}

/**
 * Get system metrics
 */
export async function getSystemMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    platform: process.platform,
    nodeVersion: process.version,
  };

  return metrics;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: string;
}> {
  const checks: Record<string, boolean> = {
    server: true,
    memory: process.memoryUsage().heapUsed < process.memoryUsage().heapTotal * 0.9,
  };

  // Check database
  try {
    db.prepare('SELECT 1').get();
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check file system
  try {
    fs.accessSync(path.join(process.cwd(), 'data'), fs.constants.W_OK);
    checks.filesystem = true;
  } catch {
    checks.filesystem = false;
  }

  const allHealthy = Object.values(checks).every(check => check);

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  };
}


