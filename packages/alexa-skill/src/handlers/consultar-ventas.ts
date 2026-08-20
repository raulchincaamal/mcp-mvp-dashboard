import { getRequestType, getIntentName, HandlerInput, RequestHandler } from 'ask-sdk-core';

export const ConsultarVentasIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'ConsultarVentasIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    const speechText =
      'Las ventas del mes suman 2 millones 450 mil pesos, con 312 operaciones de crédito. El ticket promedio es de 7 mil 850 pesos.';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('¿Necesitas algo más?')
      .getResponse();
  },
};
