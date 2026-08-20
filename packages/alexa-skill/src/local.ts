import express from 'express';
import { SkillBuilders } from 'ask-sdk-core';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { config } from './config';

import { LaunchRequestHandler } from './handlers/launch';
import { ConsultarVentasIntentHandler } from './handlers/consultar-ventas';
import { AuraMacropayIntentHandler } from './handlers/aura-macropay';
import { MapaVentasIntentHandler } from './handlers/mapa-ventas';
import { HelpHandler, CancelStopHandler, SessionEndedHandler, ErrorHandler } from './handlers/common';

const skill = SkillBuilders.custom()
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

const app = express();
app.post('/alexa', adapter.getRequestHandlers());

app.get('/health', (_req, res) => {
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
