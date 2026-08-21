import { HandlerInput } from 'ask-sdk-core';

interface UserProfile {
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  id: string;
}

/**
 * Obtiene el access token de Microsoft del usuario vinculado.
 * Retorna undefined si el usuario no ha vinculado su cuenta.
 */
export function getAccessToken(handlerInput: HandlerInput): string | undefined {
  return handlerInput.requestEnvelope.context.System.user.accessToken;
}

/**
 * Obtiene el perfil del usuario desde Microsoft Graph.
 */
export async function getUserProfile(accessToken: string): Promise<UserProfile> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph responded with ${response.status}`);
  }

  return response.json() as Promise<UserProfile>;
}
