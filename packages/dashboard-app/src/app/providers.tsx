"use client";

import { useEffect } from "react";
import { Monitor } from "@macropaytd/lib-front-fifo-monitor";
import { TranslationProvider, useTranslation } from "@macropaytd/lib-front-i18n-module";
import { LoadingOverlayProvider } from "@macropaytd/lib-front-loading-overlay";
import { startMessageListener } from "@macropaytd/lib-front-fifo-message-manager";
import { ZustandMonitor, type MonitorableStore } from "@macropaytd/lib-front-zustand-monitor";
import { orchestrator } from "@/shared/orchestrator";
import { i18nConfig } from "@/shared/i18n";
import { appStore } from "@/shared/store";
import { FeedbackProvider, sharedFeedbackStore } from "@/shared/feedback";

// Adapter: sharedFeedbackStore (StoreApi) -> MonitorableStore interface
const feedbackMonitorable: MonitorableStore = {
  get: () => sharedFeedbackStore.getState() as unknown as Record<string, unknown>,
  subscribe: (listener) => sharedFeedbackStore.subscribe(listener as (state: unknown, prev: unknown) => void),
};

/**
 * Preloads all app namespaces before rendering children.
 * Prevents raw i18n keys from flashing in any page/component.
 */
function TranslationGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useTranslation(["common", "validations"]);

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { unsubscribe } = startMessageListener(orchestrator);
    return () => unsubscribe();
  }, []);

  return (
    <TranslationProvider config={i18nConfig}>
      <TranslationGate>
        <LoadingOverlayProvider orchestrator={orchestrator}>
          <FeedbackProvider store={sharedFeedbackStore}>
            {children}
          </FeedbackProvider>
        </LoadingOverlayProvider>
        {process.env.NODE_ENV !== "production" && (
          <>
            <Monitor orchestrator={orchestrator} />
            <ZustandMonitor
              stores={[
                { name: "AppStore", appStore: appStore as unknown as MonitorableStore },
                { name: "FeedbackStore", feedbackStore: feedbackMonitorable },
              ]}
            />
          </>
        )}
      </TranslationGate>
    </TranslationProvider>
  );
}
