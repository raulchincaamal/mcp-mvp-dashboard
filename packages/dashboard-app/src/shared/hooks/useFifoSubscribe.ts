import { useEffect } from 'react';
import { orchestrator } from '@/shared/orchestrator';
import type { QueueEvent } from '@macropaytd/lib-front-fifo-core';

/**
 * Subscribe to a FIFO event type. Auto-unsubscribes on unmount.
 */
export function useFifoSubscribe<T = unknown>(
  eventType: string,
  handler: (event: QueueEvent<T>) => void,
) {
  useEffect(() => {
    const sub = orchestrator.on<T>(eventType, handler);
    return () => sub.unsubscribe();
  }, [eventType, handler]);
}
