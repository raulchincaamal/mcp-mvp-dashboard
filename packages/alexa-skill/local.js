const express = require('express');
const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');
const config = require('./config');

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

// Express server for local development
const app = express();
app.post('/alexa', adapter.getRequestHandlers());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', skill: config.SKILL_NAME });
});

app.listen(config.LOCAL_PORT, () => {
  console.log(`\n  Alexa Skill local server running`);
  console.log(`  Endpoint: http://localhost:${config.LOCAL_PORT}/alexa`);
  console.log(`  Health:   http://localhost:${config.LOCAL_PORT}/health`);
  console.log(`\n  Use Postman to send POST requests to /alexa`);
  console.log(`  Or use ngrok to expose this endpoint to Alexa:\n`);
  console.log(`    ngrok http ${config.LOCAL_PORT}\n`);
});
