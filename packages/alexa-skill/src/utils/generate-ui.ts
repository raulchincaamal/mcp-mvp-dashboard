import { config } from '../config';

export interface GenerateUiRequest {
  intent: string;
  userId: string;
}

export interface GenerateUiResponse {
  dashboardUrl?: string;
  speech?: string;
  [key: string]: unknown;
}

/**
 * Llama al endpoint de generación de UI a partir de un intent de voz.
 */
export async function generateUi(
  request: GenerateUiRequest,
): Promise<GenerateUiResponse> {
  // TODO: Remover logs — solo para pruebas
  console.log('[generateUi] Request:', JSON.stringify(request));
  console.log('[generateUi] URL:', config.GENERATE_UI_API_URL);

  const startTime = Date.now();
  const response = await fetch(config.GENERATE_UI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const elapsed = Date.now() - startTime;
  console.log(
    '[generateUi] Response status:',
    response.status,
    `(${elapsed}ms)`,
  );

  if (!response.ok) {
    throw new Error(
      `Generate UI API responded with ${response.status}: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as GenerateUiResponse;
  console.log('[generateUi] Response body:', JSON.stringify(data));
  return data;
}

