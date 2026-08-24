import { createStoreFactory } from '@macropaytd/lib-front-fifo-zustand';
import { orchestrator } from '@/shared/orchestrator';
import { FIFO_EVENTS } from '@/shared/constants/fifoEvents';
import type { DashboardConfig } from '../types';

export interface DashboardState extends Record<string, unknown> {
  config: DashboardConfig | null;
  mode: 'dashboard' | 'single';
  selectedChartIndex: number;
}

const initialState: DashboardState = {
  config: null,
  mode: 'dashboard',
  selectedChartIndex: 0,
};

export const { appStore: dashboardStore, registerHandler } =
  createStoreFactory({
    orchestrator,
    initialState,
  });

registerHandler(FIFO_EVENTS.DASHBOARD.LOAD, (event, set) => {
  const config = event.payload as DashboardConfig;
  set({ config });
});

registerHandler(FIFO_EVENTS.DASHBOARD.CHART_SELECT, (event, set) => {
  const { index } = event.payload as { index: number };
  set({ selectedChartIndex: index, mode: 'single' });
});

registerHandler(FIFO_EVENTS.DASHBOARD.REFRESH, (_event, set) => {
  set({ mode: 'dashboard' });
});
