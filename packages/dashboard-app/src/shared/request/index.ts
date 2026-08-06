import { RequestClientFactory, BERequestClientFactory } from '@macropaytd/lib-front-request';
import { orchestrator } from '@/shared/orchestrator';

/** Standalone client (no fifo integration) */
export const requestClient = RequestClientFactory.create();

/** Event-driven client (fifo-core integration: loading overlay + message notifications) */
export const fifoRequestClient = RequestClientFactory.create({ orchestrator });

/** Backend-to-backend client (server-side only: route handlers calling external services) */
export const beRequestClient = BERequestClientFactory.create();
