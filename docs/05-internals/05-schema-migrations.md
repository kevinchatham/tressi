# Schema Migration Architecture

Tressi utilizes a sequential migration pipeline to maintain compatibility between evolving configuration schemas and the application runtime. The system leverages a registry of transformation functions and Zod validation to ensure that both database stored configurations and local configuration files are upgraded to the latest version before execution.

This document covers the migration pipeline, version detection mechanisms, and the implementation of transformation functions for breaking schema changes.

### Migration Architecture

The migration system ensures that configurations remain valid as the platform evolves, preventing runtime errors caused by deprecated or renamed fields.

```mermaid
sequenceDiagram
    participant CLI as CLI Entry
    participant DB as Database Migration
    participant CFG as Config Migration
    participant APP as Application Logic

    CLI->>DB: initializeDatabase()
    Note over DB: 1. Check for pending migrations
    Note over DB: 2. Create backup (tressi-vX.X.X-timestamp.db.bak)
    Note over DB: 3. Apply SQL migrations in transaction
    DB-->>CLI: Database Ready

    CLI->>CFG: JsonMigrationManager.run() / migrateFile()
    Note over CFG: 1. Check for outdated JSON schemas
    Note over CFG: 2. Create backup (config.json.bak)
    Note over CFG: 3. Apply transformations & Zod validation
    CFG-->>CLI: Configs Ready

    CLI->>APP: Execute Command (run/serve)
```

### System Components

- **JSON Migration Manager**: Orchestrates the detection and transformation of outdated configurations to ensure compatibility with the current runtime.
- **Transformation Registry**: Maintains a sequential list of version to version functions that programmatically update configuration structures.
- **Zod Validation Layer**: Verifies the final migrated configuration and injects default values to guarantee structural integrity.

### Executing the Migration Pipeline

The `JsonMigrationManager` handles two distinct migration workflows:

1.  **Database Migrations**: Triggered by the `serve` command. It scans the internal SQLite database for all stored configurations.
2.  **File Migrations**: Triggered by the `migrate` command. It validates and updates the specific configuration file provided.

Database migrations always run before configuration migrations when serving the UI. This ensures the underlying storage is ready.

#### Workflow Steps:

1.  **Version Detection**: Extracts the version string from the `$schema` field and performs a comparison using `semver`.
2.  **Environment Validation**: Executes migrations only in interactive terminals (TTY). In headless environments, the system logs a warning and continues execution.
3.  **User Confirmation**: Prompts the user to confirm the migration process if outdated configurations are detected.
4.  **Configuration Backup**: Creates a backup (e.g., `tressi.config.json.bak`) for local files before applying transformations.
5.  **Sequential Transformation**: Passes outdated configurations through a series of version to version transformation functions.
6.  **Schema Validation**: Validates the final configuration against the current Zod schema to inject default values and ensure structural integrity.
7.  **Data Persistence**: Persists the updated configuration to the database or the local file system.
8.  **Failure Summarization**: Provides a summary of any encountered failures after processing all configurations.

### Data Integrity & Visibility

Tressi maintains data integrity and provides visibility during the migration process through several safety mechanisms:

- **Automatic Backups**: Revert changes or compare versions using automatic backups (e.g., `tressi.config.json.bak`) created before migrating local files.
- **Change Summaries**: Review planned changes through human readable transformation summaries displayed during the interactive prompt.
- **Visual Diff**: Inspect exact field modifications with terminal based line by line JSON diffs highlighting added, removed, or modified fields.

### Detecting Configuration Versions

Version detection relies on the `$schema` URL in the configuration JSON. The `JsonMigrationManager` utilizes a regular expression to extract the version string (e.g., `0.0.17`) from the URL.

A valid Tressi configuration **must** include the `$schema` property. If the property is missing or does not contain a valid Tressi schema URL, the system will report a validation error and halt the migration process for that configuration.

### Registering Schema Transformations

While structural changes such as adding new fields with defaults are handled by Zod validation, semantic changes like renaming a field or changing logic require transformation functions.

These functions are defined in `projects/cli/src/data/migrations.ts` and utilize the `IJsonMigration` interface (defined in `projects/shared/src/cli/migration.types.ts`). Each migration includes a `summary` and an `up` function.

### Maintaining Type Safety

To ensure type safety without maintaining historical schemas, migrations utilize the `VersionedTressiConfig` type (defined in `projects/shared/src/cli/migration.types.ts`) and type guards.

```typescript
export type VersionedTressiConfig = {
  $schema: string;
  [key: string]: unknown;
};
```

When implementing a migration, use a type guard to narrow the `unknown` fields to the expected types for that specific version:

```typescript
// Example: Renaming a field
'0.0.17': {
  summary: "Rename 'oldField' to 'newField' for better clarity.",
  up: (config) => {
    if (!('oldField' in config) || typeof config.oldField !== 'string') {
      throw new Error('Migration 0.0.17 failed: "oldField" is missing or not a string');
    }
    const { oldField, ...rest } = config;
    return {
      ...rest,
      $schema: config.$schema.replace('0.0.17', '0.0.18'),
      newField: oldField,
    };
  }
}
```

### Applying Sequential Transformations

Migrations are applied sequentially to bridge the gap between the stored configuration version and the current application version.

```mermaid
flowchart LR
    V1[v0.0.13] -->|Fn 0.0.14| V2[v0.0.14]
    V2 -->|Fn 0.0.15| V3[v0.0.15]
    V3 -->|Fn 0.0.16| V4[v0.0.16]
    V4 -->|Fn 0.0.17| V5[v0.0.17]
    V5 -->|Zod Parse| Final[Current Version]
```

If a configuration is at version `0.0.13` and the current version is `0.0.17`, the system applies the `0.0.14`, `0.0.15`, `0.0.16`, and `0.0.17` transformations in order. Each migration key represents the **target version** of that step.

### Injecting Configuration Defaults

The final step in the migration pipeline is a call to `TressiConfigSchema.parse()`. This process achieves two objectives:

1.  **Structural Integrity**: Ensures the migrated configuration adheres to the current schema.
2.  **Default Injection**: Injects new fields defined with a `.default()` value in the Zod schema.

### Managing Migration Failures

Tressi implements a fault tolerant migration strategy to ensure that individual configuration errors do not halt system execution.

- **Error Isolation**: If a specific configuration fails during transformation or validation, the system catches the error and logs it to the terminal.
- **Continuous Processing**: The `JsonMigrationManager` continues to process any remaining outdated configurations even if previous attempts encountered errors.
- **Failure Summarization**: After processing all configurations, the system provides a consolidated summary of all failed migrations, including the configuration name and the specific error message.

### Next Steps

Explore the [Database Migration Architecture](./06-database-migrations.md) to learn how Tressi maintains the internal SQLite schema.
