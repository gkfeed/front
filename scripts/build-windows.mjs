import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILDER_IMAGE = 'electronuserland/builder:wine@sha256:41ae540902461b6cbc988987db79547fcc10cda04d2a6c6367504f59d4b37c64';
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const builderArguments = ['electron-builder', '--win', 'nsis', '--x64'];

if (process.platform === 'win32' || commandExists('wine')) {
  run('npx', builderArguments, { cwd: repositoryRoot });
} else {
  if (!commandExists('docker')) {
    throw new Error('Building Windows on Linux requires either Wine or Docker.');
  }

  run('docker', [
    'run', '--rm',
    '-v', `${repositoryRoot}:/project`,
    '-v', 'gkfeed-electron-node-modules:/project/node_modules',
    '-v', 'gkfeed-electron-cache:/root/.cache/electron',
    '-v', 'gkfeed-builder-cache:/root/.cache/electron-builder',
    '-w', '/project',
    BUILDER_IMAGE,
    '/bin/bash', '-c', 'npm ci && npx electron-builder --win nsis --x64',
  ]);

  if (process.getuid && process.getgid) {
    run('docker', [
      'run', '--rm',
      '-v', `${repositoryRoot}/release:/release`,
      BUILDER_IMAGE,
      'chown', '-R', `${process.getuid()}:${process.getgid()}`, '/release',
    ]);
  }
}

function commandExists(command) {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { ...options, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
