import { createFeedbackStore, createValidationSync } from '@macropaytd/lib-front-field-feedback';

export { FeedbackProvider, FieldFeedback, useFeedbackStore, useFieldFeedback } from '@macropaytd/lib-front-field-feedback';

/**
 * Shared feedback store — pass to FeedbackProvider AND to sync functions
 * so both read/write from the same instance.
 */
export const sharedFeedbackStore = createFeedbackStore();

/**
 * Creates a validation sync bridge for a given schema.
 * Writes to the shared store so FeedbackProvider components can read it.
 *
 * Returns an unsubscribe function for cleanup.
 */
export function initFeedbackSync(schemaId: string, prefix?: string) {
  return createValidationSync({ schemaId, prefix, store: sharedFeedbackStore });
}
