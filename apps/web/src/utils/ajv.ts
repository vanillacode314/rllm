import Ajv from 'ajv/dist/2020';
import draft7MetaSchema from 'ajv/lib/refs/json-schema-draft-07.json';

export const ajv = new Ajv({
  allErrors: true,
  schemas: [draft7MetaSchema]
});
