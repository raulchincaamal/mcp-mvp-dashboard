import { Orchestrator } from '@macropaytd/lib-front-fifo-core';
import { setOrchestrator } from '@macropaytd/lib-front-zod-validator';

export const orchestrator = new Orchestrator({
  timeoutMs: 10_000,
  backpressureThreshold: 500,
});

setOrchestrator(orchestrator);
