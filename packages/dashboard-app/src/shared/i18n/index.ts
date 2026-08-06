import { useCallback } from 'react';
import { useI18nContext } from '@macropaytd/lib-front-i18n-module';
import type { II18nConfig } from '@macropaytd/lib-front-i18n-module';

export const i18nConfig: II18nConfig = {
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
  fallbackLanguage: 'en',
  namespacesPath: '/locales',
  defaultNamespace: 'common',
};

/**
 * Lightweight translation hook for components rendered AFTER TranslationGate.
 * Skips the per-hook loading state since namespaces are pre-loaded.
 */
export function useT(namespace?: string) {
  const { service, language } = useI18nContext();
  const ns = namespace || 'common';

  const t = useCallback(
    (key: string, options?: Record<string, string | number | boolean>) => {
      return service.translate(key, { ns, ...options });
    },
    [service, ns, language]
  );

  return { t, language };
}
