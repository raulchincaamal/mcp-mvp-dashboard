const Alexa = require('ask-sdk-core');
const config = require('../config');

const MapaVentasIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'MapaVentasIntent';
  },
  handle(handlerInput) {
    const url = `${config.SUITE_CORPORATIVO_URL}/reports/sales`;
    const speechText = 'Aquí tienes el mapa de ventas. Te envié el enlace a tu app de Alexa.';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Mapa de Ventas', `Accede al mapa de ventas aquí:\n${url}`)
      .reprompt('¿Necesitas algo más?')
      .getResponse();
  }
};

module.exports = MapaVentasIntentHandler;
