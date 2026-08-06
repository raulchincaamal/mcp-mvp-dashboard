import { useCallback } from 'react';
import { orchestrator } from '@/shared/orchestrator';

/**
 * Returns a stable dispatch function for emitting FIFO events.
 */
export function useFifoEmit() {
  const emit = useCallback(<T = unknown>(eventType: string, payload: T) => {
    orchestrator.dispatch(eventType, payload);
  }, []);

  return emit;
}
