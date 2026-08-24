import { http } from '@google-cloud/functions-framework';
import { SkillBuilders } from 'ask-sdk-core';

import { LaunchRequestHandler } from './handlers/launch';
import { CatchAllIntentHandler } from './handlers/catch-all';
import {
  HelpHandler,
  CancelStopHandler,
  SessionEndedHandler,
  ErrorHandler,
} from './handlers/common';

const skill = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    CatchAllIntentHandler,
    HelpHandler,
    CancelStopHandler,
    SessionEndedHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .create();

// Cloud Run Functions (2nd gen) entry point
http('alexaSkill', async (req, res) => {
  try {
    const response = await skill.invoke(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.error('Skill invocation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
