#!/usr/bin/env tsx

/** biome-ignore-all lint/suspicious/noConsole: default */

/**
 * ============================================================
 *  squash.ts — Safe Squash Commit Script
 * ============================================================
 *
 * This script safely squashes all commits on the current
 * feature branch into a single commit. It performs the
 * following steps:
 *
 *   1. Detects the current branch automatically.
 *   2. Creates a timestamped backup branch.
 *   3. Resets the feature branch to the chosen base branch
 *      (e.g., `dev`, `main`).
 *   4. Stages all changes.
 *   5. Opens VS Code to write the new commit message.
 *   6. Force-pushes the updated branch using
 *      `--force-with-lease`.
 *
 * BACKUP:
 * ------------------------------------------------------------
 * A backup branch is created before any rewriting occurs.
 * You can restore it at any time:
 *
 *     git checkout <backup-branch-name>
 *
 * USAGE:
 * ------------------------------------------------------------
 *   tsx squash.ts <base-branch>
 *
 * Example:
 *   tsx squash.ts dev
 *
 * REQUIREMENTS:
 * ------------------------------------------------------------
 * - VS Code must be installed and accessible via `code`.
 *
 */

import { execSync } from 'node:child_process';

process.chdir(__dirname);

function sh(cmd: string): NonSharedBuffer {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit' });
}

// ---------------------------------------------
// Parse base branch argument
// ---------------------------------------------
const BASE_BRANCH: string = process.argv[2];

if (!BASE_BRANCH) {
  console.error('❌ Missing base branch argument.\n');
  console.error('Usage: tsx squash.ts <base-branch>');
  process.exit(1);
}

// ---------------------------------------------
// Ensure inside a Git repo
// ---------------------------------------------
try {
  execSync('git rev-parse --is-inside-work-tree');
} catch {
  console.error('❌ Not inside a git repository.');
  process.exit(1);
}

// ---------------------------------------------
// Determine current branch dynamically
// ---------------------------------------------
const FEATURE_BRANCH: string = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

console.log(`🔎 Feature branch detected: ${FEATURE_BRANCH}`);
console.log(`🔎 Base branch: ${BASE_BRANCH}`);

// ---------------------------------------------
// Safety Check: Prevent using the same branch
// ---------------------------------------------
if (FEATURE_BRANCH === BASE_BRANCH) {
  console.error(
    `❌ Feature branch and base branch are the same: '${FEATURE_BRANCH}'.\n` +
      '   Aborting to avoid destroying history.',
  );
  process.exit(1);
}

const BACKUP_BRANCH = `${FEATURE_BRANCH}-backup-${Date.now()}`;

console.log('=====================================');
console.log(' SAFE MEGA COMMIT SQUASH SCRIPT');
console.log('=====================================');

// ---------------------------------------------
// Step 1: Create backup branch (local + remote)
// ---------------------------------------------
console.log(`\nCreating backup branch: ${BACKUP_BRANCH}`);
sh(`git checkout -b ${BACKUP_BRANCH}`);

// ---------------------------------------------
// Step 2: Reset feature branch to base branch
// ---------------------------------------------
console.log(`\nResetting ${FEATURE_BRANCH} to ${BASE_BRANCH}...`);
sh(`git checkout ${FEATURE_BRANCH}`);
sh(`git reset ${BASE_BRANCH}`);

// ---------------------------------------------
// Step 3: Stage everything
// ---------------------------------------------
console.log('\nStaging all changes...');
sh('git add -A');

// ---------------------------------------------
// Step 4: Mega commit (opens VS Code commit editor)
// ---------------------------------------------
console.log('\nCreating mega commit...');

sh(`git config --global core.editor "code -w"`);

// Open VS Code for commit message
sh('git commit');

// ---------------------------------------------
// Step 5: Force push
// ---------------------------------------------
console.log('\nForce pushing rewritten branch...');
sh('git push --force-with-lease');

console.log('\n🎉 Done! Branch history is now a single mega commit.');
console.log(`🔒 Backup preserved at: ${BACKUP_BRANCH} (pushed to origin)`);
