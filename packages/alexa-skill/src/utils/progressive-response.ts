import { HandlerInput } from 'ask-sdk-core';

/**
 * Envía un Progressive Response a Alexa para mantener al usuario informado
 * mientras se procesa una operación larga.
 *
 * Usa la API REST directamente con fetch (sin dependencia de ask-sdk completo).
 * Ref: https://developer.amazon.com/docs/custom-skills/send-the-user-a-progressive-response.html
 */
export async function sendProgressiveResponse(
  handlerInput: HandlerInput,
  speech: string,
): Promise<void> {
  const { requestEnvelope } = handlerInput;
  const requestId = requestEnvelope.request.requestId;
  const apiEndpoint = requestEnvelope.context.System.apiEndpoint;
  const apiAccessToken = requestEnvelope.context.System.apiAccessToken;

  if (!apiAccessToken) {
    console.warn('[ProgressiveResponse] No apiAccessToken available, skipping.');
    return;
  }

  const directive = {
    header: { requestId },
    directive: {
      type: 'VoicePlayer.Speak',
      speech,
    },
  };

  const response = await fetch(`${apiEndpoint}/v1/directives`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiAccessToken}`,
    },
    body: JSON.stringify(directive),
  });

  if (!response.ok) {
    console.warn(
      `[ProgressiveResponse] Failed with status ${response.status}:`,
      await response.text(),
    );
  }
}
