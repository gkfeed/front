import { spawn } from 'node:child_process';

const bffPort = process.env.BFF_PORT ?? process.env.PORT ?? '3000';
const bffTarget = process.env.BFF_TARGET ?? `http://127.0.0.1:${bffPort}`;

const services = [
  {
    name: 'front',
    command: 'node_modules/.bin/vite',
    args: ['--host', '0.0.0.0', '--port', '4200'],
    env: { ...process.env, BFF_TARGET: bffTarget },
  },
  {
    name: 'bff',
    command: 'node_modules/.bin/tsx',
    args: ['watch', 'server/index.ts'],
    env: { ...process.env, PORT: bffPort },
  },
];

const children = services.map(({ name, command, args, env }) => ({
  name,
  process: spawn(command, args, { env, stdio: 'inherit' }),
}));

let shuttingDown = false;

function shutdown(signal, exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (child.process.exitCode === null && child.process.signalCode === null) {
      child.process.kill(signal);
    }
  }

  const forceShutdown = setTimeout(() => {
    for (const child of children) {
      if (child.process.exitCode === null && child.process.signalCode === null) {
        child.process.kill('SIGKILL');
      }
    }
  }, 5_000);
  forceShutdown.unref();

  Promise.all(children.map(({ process: child }) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('exit', resolve);
  }))).then(() => process.exit(exitCode));
}

for (const { name, process: child } of children) {
  child.on('error', (error) => {
    console.error(`Failed to start ${name}:`, error);
    shutdown('SIGTERM', 1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal) console.error(`${name} stopped by ${signal}`);
    shutdown('SIGTERM', code ?? 1);
  });
}

process.on('SIGINT', () => shutdown('SIGINT', 130));
process.on('SIGTERM', () => shutdown('SIGTERM', 143));
