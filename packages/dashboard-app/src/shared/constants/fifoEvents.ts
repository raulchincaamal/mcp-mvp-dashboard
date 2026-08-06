/**
 * FIFO Event Type Constants
 * Centralized event definitions for the dashboard application
 */

export const FIFO_EVENTS = {
  DASHBOARD: {
    LOAD: 'dashboard:load',
    REFRESH: 'dashboard:refresh',
    CHART_SELECT: 'dashboard:chart-select',
  },
} as const;

/**
 * Helper to get all event types for easier discovery
 */
export const getAllEventTypes = () =>
  Object.values(FIFO_EVENTS).flatMap((category) =>
    Object.values(category),
  );
