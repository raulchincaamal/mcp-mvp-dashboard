import { getRequestType, getIntentName, HandlerInput, RequestHandler } from 'ask-sdk-core';

export const AuraMacropayIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'AuraMacropayIntent'
    );
  },
  handle(handlerInput: HandlerInput) {
    const speechText = `El Aura de Macropay es nuestra esencia como empresa. Es lo que nos define, lo que nos mueve y lo que nos diferencia de cualquier otra compañía en el mercado.

Nace de la convicción de que el acceso al crédito puede transformar vidas en México. No somos solo una empresa de tecnología financiera, somos un movimiento que busca democratizar las oportunidades.

Nuestros valores fundamentales son cinco. Primero, Innovación: no nos conformamos con lo que existe, siempre buscamos una mejor forma de hacer las cosas. Retamos el status quo y abrazamos el cambio como herramienta de crecimiento.

Segundo, Compromiso con el cliente: cada decisión que tomamos tiene al cliente en el centro. No vendemos productos, construimos soluciones que realmente mejoran la vida de las personas.

Tercero, Trabajo en equipo: creemos que juntos llegamos más lejos. No existen logros individuales en Macropay, todo es del equipo. Celebramos juntos y enfrentamos los retos juntos.

Cuarto, Pasión: amamos lo que hacemos y eso se nota en cada interacción, en cada línea de código, en cada atención en punto de venta. La pasión es contagiosa y es lo que nos mantiene avanzando.

Quinto, Integridad: hacemos lo correcto aunque nadie esté viendo. Somos transparentes con nuestros clientes, con nuestros colaboradores y con nosotros mismos.

En el día a día, el Aura se refleja en cómo tratamos a nuestros clientes: con respeto, transparencia y un genuino interés por ayudarles. Se refleja en nuestras juntas donde todas las voces son escuchadas. Se refleja en nuestra forma de innovar, probando cosas nuevas sin miedo al error.

En las sucursales, el Aura cobra vida en cada interacción. Desde cómo recibimos al cliente cuando entra, hasta cómo le explicamos sus opciones de crédito sin presionarlo. Cada colaborador en punto de venta es un embajador del Aura.

La tecnología en Macropay está al servicio del Aura. Desarrollamos herramientas que empoderan tanto al colaborador como al cliente. Desde nuestro sistema de crédito hasta las herramientas internas, todo está diseñado pensando en simplificar y mejorar la experiencia.

Vivir el Aura es simple: pregúntate siempre, esto beneficia al cliente, estoy siendo transparente, estoy colaborando con mi equipo, estoy dando lo mejor de mí. Si las respuestas son sí, estás viviendo el Aura. No importa si eres de ventas, tecnología, operaciones o recursos humanos. El Aura es de todos y para todos.

Eso es el Aura de Macropay. ¿Puedo ayudarte con algo más?`;

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('¿Necesitas algo más?')
      .getResponse();
  },
};
