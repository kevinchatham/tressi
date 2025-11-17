/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { TressiConfigSchema } from 'tressi-common';
import { zodToJsonSchema } from 'zod-to-json-schema';

import pkg from '../../package.json';

const schema = zodToJsonSchema(TressiConfigSchema, 'TressiConfigSchema');

const schemaString = JSON.stringify(schema, null, 2);

const schemasDir = path.resolve(__dirname, '../../schemas');
if (!fs.existsSync(schemasDir)) {
  fs.mkdirSync(schemasDir);
}

const versionedSchemaPath = path.resolve(
  schemasDir,
  `tressi.schema.v${pkg.version}.json`,
);
fs.writeFileSync(versionedSchemaPath, schemaString);
console.log(`JSON schema generated at ${versionedSchemaPath}`);

const rootSchemaPath = path.resolve(__dirname, 'tressi.schema.json');
fs.writeFileSync(rootSchemaPath, schemaString);
console.log(`JSON schema generated at ${rootSchemaPath}`);
