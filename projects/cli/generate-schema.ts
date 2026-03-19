/** biome-ignore-all lint/suspicious/noConsole: default */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import pkg from '../../package.json';
import { TressiConfigSchema } from '../shared';

const schema: z.core.JSONSchema.JSONSchema = z.toJSONSchema(TressiConfigSchema);

const schemaString: string = JSON.stringify(schema, null, 2);

const schemasDir: string = path.resolve(__dirname, '../../schemas');
if (!fs.existsSync(schemasDir)) {
  fs.mkdirSync(schemasDir);
}

const versionedSchemaPath: string = path.resolve(schemasDir, `tressi.schema.v${pkg.version}.json`);
fs.writeFileSync(versionedSchemaPath, schemaString);
console.log(`JSON schema generated at ${versionedSchemaPath}`);

const rootSchemaPath: string = path.resolve(__dirname, 'tressi.schema.json');
fs.writeFileSync(rootSchemaPath, schemaString);
console.log(`JSON schema generated at ${rootSchemaPath}`);
