#!/bin/bash

# Build the project
npm run build

# Deploy to GCP Cloud Run Functions
gcloud functions deploy alexaSkill \
  --source dist \
  --runtime nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1 \
  --entry-point alexaSkill \
  --set-secrets "SUITE_CORPORATIVO_URL=SUITE_CORPORATIVO_URL:latest,GRAPH_API_URL=GRAPH_API_URL:latest,SKILL_NAME=SKILL_NAME:latest"
