import { Validator, SchemaRegistry, ValidationStore } from '@macropaytd/lib-front-zod-validator';

export const schemaRegistry = new SchemaRegistry();
export const validator = new Validator();
export const validationStore = new ValidationStore();
