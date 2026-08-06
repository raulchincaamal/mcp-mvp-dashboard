"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@macropaytd/lib-front-fifo-zustand/react";
import { Button } from "@macropaytd/lib-front-ui-components";
import { useT } from "@/shared/i18n";
import { orchestrator } from "@/shared/orchestrator";
import { FIFO_EVENTS } from "@/shared/constants/fifoEvents";
import { dashboardStore } from "../store";
import type { DashboardConfig } from "../types";
import DashboardRenderer from "./DashboardRenderer";
import ChartRenderer from "./ChartRenderer";
import sampleDashboard from "../sample-data/sample-dashboard.json";

export default function DashboardContainer() {
  const { t } = useT();
  const config = useAppStore(dashboardStore, (s) => s.config);
  const mode = useAppStore(dashboardStore, (s) => s.mode);
  const selectedChartIndex = useAppStore(dashboardStore, (s) => s.selectedChartIndex);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      orchestrator.dispatch(
        FIFO_EVENTS.DASHBOARD.LOAD,
        sampleDashboard as DashboardConfig,
      );
      setLoaded(true);
    }
  }, [loaded]);

  if (!config) return null;

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Button
          variant={mode === "dashboard" ? "default" : "outline"}
          size="sm"
          onClick={() => orchestrator.dispatch(FIFO_EVENTS.DASHBOARD.REFRESH, {})}
        >
          {t("dashboard.mode_dashboard")}
        </Button>
        <Button
          variant={mode === "single" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            orchestrator.dispatch(FIFO_EVENTS.DASHBOARD.CHART_SELECT, {
              index: selectedChartIndex,
            })
          }
        >
          {t("dashboard.mode_single")}
        </Button>
      </div>

      {mode === "dashboard" ? (
        <DashboardRenderer config={config} />
      ) : (
        <ChartRenderer config={config.charts[selectedChartIndex]} />
      )}
    </main>
  );
}
