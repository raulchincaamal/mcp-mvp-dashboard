const Alexa = require('ask-sdk-core');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Hola, soy tu asistente de Macropay. Puedes preguntarme sobre el aura, consultar ventas o pedir el mapa de ventas. ¿Qué necesitas?')
      .reprompt('¿Qué quieres consultar?')
      .getResponse();
  }
};

module.exports = LaunchRequestHandler;
