import {
  getRequestType,
  getIntentName,
  HandlerInput,
  RequestHandler,
} from 'ask-sdk-core';
import { getAccessToken, getUserProfile } from '../utils/auth';
import { generateUi } from '../utils/generate-ui';
import { responseHelper } from '../utils/response-builder';
import { sendProgressiveResponse } from '../utils/progressive-response';

export const CatchAllIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'CatchAllIntent'
    );
  },
  async handle(handlerInput: HandlerInput) {
    const slots = (handlerInput.requestEnvelope.request as any).intent?.slots;
    const userSaid = slots?.query?.value || '';

    if (!userSaid) {
      return handlerInput.responseBuilder
        .speak('No entendí lo que dijiste. ¿Puedes repetirlo?')
        .reprompt('¿Qué necesitas?')
        .getResponse();
    }

    // Obtener access token de Microsoft 365
    const accessToken = getAccessToken(handlerInput);

    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak(
          'Necesitas vincular tu cuenta de Microsoft para usar esta función. Te envié una tarjeta a la app de Alexa.',
        )
        .withLinkAccountCard()
        .getResponse();
    }

    try {
      // Obtener userId de Microsoft 365
      const userProfile = await getUserProfile(accessToken);
      const userId = userProfile.id;

      // TODO: Remover este log — solo para pruebas
      console.log('[CatchAll] Microsoft 365 userId:', userId);

      // Enviar progressive response para que el usuario sepa que estamos procesando
      await sendProgressiveResponse(
        handlerInput,
        'Dame un momento mientras proceso tu solicitud.',
      ).catch((err) =>
        console.warn('[CatchAll] Progressive response failed:', err),
      );

      // Llamar al API del LLM con el intent y userId
      const result = await generateUi({ intent: userSaid, userId });

      // Si la respuesta incluye una URL de dashboard, enviar card con enlace
      if (result.dashboardUrl) {
        return responseHelper.withLink(
          handlerInput,
          result.speech ||
            `Listo, tu dashboard fue generado. (userId: ${userId})`,
          'Dashboard Generado',
          result.dashboardUrl,
        );
      }

      // TODO: Remover userId del speech — solo para pruebas
      return handlerInput.responseBuilder
        .speak(result.speech || `Solicitud procesada. Tu userId es: ${userId}`)
        .reprompt('¿Necesitas algo más?')
        .getResponse();
    } catch (error) {
      console.error('Error en CatchAllIntent:', error);
      return handlerInput.responseBuilder
        .speak('Hubo un problema al procesar tu solicitud. Intenta de nuevo.')
        .reprompt('¿Algo más?')
        .getResponse();
    }
  },
};
