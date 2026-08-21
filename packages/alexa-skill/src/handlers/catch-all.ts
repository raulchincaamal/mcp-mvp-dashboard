import { getRequestType, getIntentName, HandlerInput, RequestHandler } from 'ask-sdk-core';

export const CatchAllIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'CatchAllIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    const slots = (handlerInput.requestEnvelope.request as any).intent?.slots;
    const userSaid = slots?.query?.value || 'No entendí lo que dijiste';

    // Aquí puedes hacer lo que quieras con el texto del usuario:
    // - Enviarlo a un LLM
    // - Pasarlo a tu MCP Main
    // - Devolverlo como eco

    return handlerInput.responseBuilder
      .speak(`Dijiste: ${userSaid}`)
      .reprompt('¿Algo más?')
      .getResponse();
  },
};
