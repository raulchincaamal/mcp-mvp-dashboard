import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';

/**
 * Helpers para construir respuestas comunes de Alexa.
 */
export const responseHelper = {
  /**
   * Construye una respuesta con un enlace (card con URL).
   */
  withLink(handlerInput: HandlerInput, speech: string, cardTitle: string, url: string): Response {
    return handlerInput.responseBuilder
      .speak(speech)
      .withSimpleCard(cardTitle, `Accede aquí:\n${url}`)
      .reprompt('¿Necesitas algo más?')
      .getResponse();
  },
};
