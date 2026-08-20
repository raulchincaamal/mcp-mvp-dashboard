import { SkillBuilders } from 'ask-sdk-core';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { Request, Response } from 'express';

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

// Cloud Function entry point
export const alexaSkill = (req: Request, res: Response): void => {
  adapter.handle(req, res);
};
