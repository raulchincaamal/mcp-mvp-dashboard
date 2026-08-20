const Alexa = require('ask-sdk-core');

const HelpHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Puedes preguntarme sobre el aura de Macropay, consultar ventas o pedir el mapa de ventas. ¿Qué prefieres?')
      .reprompt('¿Qué necesitas?')
      .getResponse();
  }
};

const CancelStopHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Hasta luego.')
      .getResponse();
  }
};

const SessionEndedHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() { return true; },
  handle(handlerInput, error) {
    console.log(`Error: ${error.message}`);
    return handlerInput.responseBuilder
      .speak('Hubo un error. Intenta de nuevo.')
      .getResponse();
  }
};

module.exports = { HelpHandler, CancelStopHandler, SessionEndedHandler, ErrorHandler };
