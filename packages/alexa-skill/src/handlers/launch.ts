import { getRequestType, HandlerInput, RequestHandler } from 'ask-sdk-core';

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput: HandlerInput) {
    return handlerInput.responseBuilder
      .speak('Hola, soy tu asistente de Macropay. Puedes preguntarme sobre el aura, consultar ventas o pedir el mapa de ventas. ¿Qué necesitas?')
      .reprompt('¿Qué quieres consultar?')
      .getResponse();
  },
};
