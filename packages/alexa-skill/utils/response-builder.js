/**
 * Helpers para construir respuestas comunes de Alexa.
 */
const responseHelper = {
  /**
   * Construye una respuesta con un enlace (card con URL).
   * @param {object} handlerInput - Alexa handler input
   * @param {string} speech - Lo que Alexa dice
   * @param {string} cardTitle - Título de la tarjeta
   * @param {string} url - URL a mostrar en la tarjeta
   * @returns {object} Alexa response
   */
  withLink(handlerInput, speech, cardTitle, url) {
    return handlerInput.responseBuilder
      .speak(speech)
      .withSimpleCard(cardTitle, `Accede aquí:\n${url}`)
      .reprompt('¿Necesitas algo más?')
      .getResponse();
  },
};

module.exports = responseHelper;

