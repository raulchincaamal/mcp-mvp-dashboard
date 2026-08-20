const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');

// Handlers
const LaunchRequestHandler = require('./handlers/launch');
const ConsultarVentasIntentHandler = require('./handlers/consultar-ventas');
const AuraMacropayIntentHandler = require('./handlers/aura-macropay');
const MapaVentasIntentHandler = require('./handlers/mapa-ventas');
const { HelpHandler, CancelStopHandler, SessionEndedHandler, ErrorHandler } = require('./handlers/common');

// Build skill
const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ConsultarVentasIntentHandler,
    AuraMacropayIntentHandler,
    MapaVentasIntentHandler,
    HelpHandler,
    CancelStopHandler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .create();

const adapter = new ExpressAdapter(skill, false, false);

// Cloud Function entry point
exports.alexaSkill = (req, res) => {
  adapter.handle(req, res);
};
