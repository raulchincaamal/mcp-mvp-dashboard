import { getRequestType, getIntentName, HandlerInput, RequestHandler, ErrorHandler as AlexaErrorHandler } from 'ask-sdk-core';

export const HelpHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    return handlerInput.responseBuilder
      .speak('Puedes preguntarme sobre el aura de Macropay, consultar ventas o pedir el mapa de ventas. ¿Qué prefieres?')
      .reprompt('¿Qué necesitas?')
      .getResponse();
  },
};

export const CancelStopHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      (getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
        getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent')
    );
  },
  handle(handlerInput: HandlerInput) {
    return handlerInput.responseBuilder.speak('Hasta luego.').getResponse();
  },
};

export const SessionEndedHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput: HandlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

export const ErrorHandler: AlexaErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput: HandlerInput, error: Error) {
    console.log(`Error: ${error.message}`);
    return handlerInput.responseBuilder.speak('Hubo un error. Intenta de nuevo.').getResponse();
  },
};
