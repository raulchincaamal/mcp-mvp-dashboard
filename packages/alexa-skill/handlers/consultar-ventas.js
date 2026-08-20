const Alexa = require('ask-sdk-core');

const ConsultarVentasIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        'ConsultarVentasIntent'
    );
  },
  handle(handlerInput) {
    const speechText =
      'Las ventas del mes suman 2 millones 450 mil pesos, con 312 operaciones de crédito. El ticket promedio es de 7 mil 850 pesos.';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('¿Necesitas algo más?')
      .getResponse();
  },
};

module.exports = ConsultarVentasIntentHandler;

