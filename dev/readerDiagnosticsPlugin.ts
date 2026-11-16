import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

// Development-only diagnostics, with no signed URLs or post text in the log.
export function readerDiagnosticsPlugin(): Plugin {
  return {
    name: 'reader-diagnostics',
    apply: 'serve',
    configureServer(server) {
      const directory = join(server.config.root, '.verification');
      const path = join(directory, 'reader-prefetch.jsonl');
      server.ws.on('reader:diagnostic', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const value = data as Record<string, unknown>;
        if (typeof value.stage !== 'string' || !/^[a-z-]{1,40}$/.test(value.stage)
          || typeof value.id !== 'string' || !/^(?:unknown|\d{1,24})$/.test(value.id)
          || typeof value.time !== 'number' || !Number.isFinite(value.time)
          || typeof value.session !== 'string' || !/^[a-z0-9]{1,16}$/.test(value.session)
          || (value.context !== 'app' && value.context !== 'fixture')) return;
        const entry = { stage: value.stage, id: value.id, time: value.time, session: value.session, context: value.context,
          ...(typeof value.detail === 'string' ? { detail: value.detail.slice(0, 80) } : {}) };
        void mkdir(directory, { recursive: true }).then(() => appendFile(path, `${JSON.stringify(entry)}\n`))
          .catch((error: unknown) => server.config.logger.warn(`Reader diagnostics: ${String(error)}`));
      });
    },
  };
}
