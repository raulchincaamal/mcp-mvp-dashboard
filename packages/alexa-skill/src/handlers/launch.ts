import { getRequestType, HandlerInput, RequestHandler } from 'ask-sdk-core';
import { getAccessToken, getUserProfile } from '../utils/auth';

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput: HandlerInput) {
    const accessToken = getAccessToken(handlerInput);

    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak(
          'Bienvenido. Necesitas vincular tu cuenta de Microsoft para continuar. Te envié una tarjeta a la app de Alexa.',
        )
        .withLinkAccountCard()
        .getResponse();
    }

    try {
      const user = await getUserProfile(accessToken);
      return handlerInput.responseBuilder
        .speak(
          `Hola ${user.displayName}. Puedes preguntarme sobre el aura, consultar ventas o pedir el mapa de ventas. ¿Qué necesitas?`,
        )
        .reprompt('¿Qué quieres consultar?')
        .getResponse();
    } catch {
      return handlerInput.responseBuilder
        .speak(
          'Hola, estás autenticado. Puedes preguntarme sobre el aura, consultar ventas o pedir el mapa de ventas. ¿Qué necesitas?',
        )
        .reprompt('¿Qué quieres consultar?')
        .getResponse();
    }
  },
};

