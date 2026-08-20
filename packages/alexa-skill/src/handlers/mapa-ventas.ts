import { getRequestType, getIntentName, HandlerInput, RequestHandler } from 'ask-sdk-core';
import { config } from '../config';

export const MapaVentasIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'MapaVentasIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    const url = `${config.SUITE_CORPORATIVO_URL}/reports/sales`;

    return handlerInput.responseBuilder
      .speak('Aquí tienes el mapa de ventas. Te envié el enlace a tu app de Alexa.')
      .withSimpleCard('Mapa de Ventas', `Accede al mapa de ventas aquí:\n${url}`)
      .reprompt('¿Necesitas algo más?')
      .getResponse();
  },
};
