import fs from 'fs';
import path from 'path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TressiConfigSchema } from '../src/config';
import pkg from '../package.json';

const schema = zodToJsonSchema(TressiConfigSchema, 'TressiConfigSchema');

const schemaString = JSON.stringify(schema, null, 2);

const schemasDir = path.resolve(process.cwd(), 'schemas');
if (!fs.existsSync(schemasDir)) {
  fs.mkdirSync(schemasDir);
}

const versionedSchemaPath = path.resolve(
  schemasDir,
  `tressi.schema.v${pkg.version}.json`,
);
fs.writeFileSync(versionedSchemaPath, schemaString);
console.log(`JSON schema generated at ${versionedSchemaPath}`);

const rootSchemaPath = path.resolve(process.cwd(), 'tressi.schema.json');
fs.writeFileSync(rootSchemaPath, schemaString);
console.log(`JSON schema generated at ${rootSchemaPath}`);
