import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const sourceRoots = [
  join(repositoryRoot, 'server'),
  join(repositoryRoot, 'shared'),
  join(repositoryRoot, 'src/react'),
];
const sourceFiles = sourceRoots.flatMap(collectSourceFiles);
const sourceFileSet = new Set(sourceFiles);

describe('module architecture', () => {
  it('keeps production modules free of relative import cycles', () => {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    for (const file of sourceFiles) visit(file, []);

    function visit(file: string, path: string[]): void {
      if (visited.has(file)) return;
      if (visiting.has(file)) {
        const cycleStart = path.indexOf(file);
        throw new Error(`Import cycle: ${[...path.slice(cycleStart), file].map(displayPath).join(' -> ')}`);
      }

      visiting.add(file);
      for (const importedFile of getRelativeImports(file)) visit(importedFile, [...path, file]);
      visiting.delete(file);
      visited.add(file);
    }
  });

  it('keeps domain, feature, and server modules on their contract side of the boundary', () => {
    const violations = sourceFiles.flatMap((file) => getRelativeImports(file).flatMap((importedFile) => {
      const source = displayPath(file);
      const target = displayPath(importedFile);
      if (source.startsWith('src/react/domain/')
        && [
          'application',
          'services',
          'state',
          'hooks',
          'features',
          'components',
          'pages',
          'adapters',
        ].some((layer) => target.startsWith(`src/react/${layer}/`))) {
        return [`${source} -> ${target}`];
      }
      if (source.startsWith('src/react/features/')
        && (target.startsWith('src/react/application/') || target.startsWith('src/react/services/'))) {
        return [`${source} -> ${target}`];
      }
      if (source.startsWith('server/application/')
        && (target.startsWith('server/http/')
          || target.startsWith('server/preview/')
          || target.startsWith('server/transport/')
          || target === 'server/tiktok.ts'
          || target === 'server/publicHttp.ts'
          || target === 'server/publicAddress.ts')) {
        return [`${source} -> ${target}`];
      }
      if (source.startsWith('server/http/')
        && ((target.startsWith('server/preview/') && target !== 'server/preview/errors.ts')
          || target === 'server/tiktok.ts'
          || target === 'server/publicHttp.ts'
          || target === 'server/publicAddress.ts')) {
        return [`${source} -> ${target}`];
      }
      if (source.startsWith('server/transport/') && target.startsWith('server/http/')) {
        return [`${source} -> ${target}`];
      }
      return [];
    }));

    expect(violations).toEqual([]);
  });
});

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const file = join(directory, entry);
    if (statSync(file).isDirectory()) return collectSourceFiles(file);
    if (!['.ts', '.tsx'].includes(extname(file)) || file.includes('.test.')) return [];
    return [file];
  });
}

function getRelativeImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const imports = [...source.matchAll(/(?:from\s+|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)]
    .map((match) => match[2]);
  return imports.flatMap((specifier) => {
    const resolved = resolveSourceFile(dirname(file), specifier);
    return resolved && sourceFileSet.has(resolved) ? [resolved] : [];
  });
}

function resolveSourceFile(directory: string, specifier: string): string | undefined {
  const withoutJavaScriptExtension = specifier.replace(/\.js$/, '');
  const candidates = [
    resolve(directory, withoutJavaScriptExtension),
    resolve(directory, `${withoutJavaScriptExtension}.ts`),
    resolve(directory, `${withoutJavaScriptExtension}.tsx`),
    resolve(directory, withoutJavaScriptExtension, 'index.ts'),
    resolve(directory, withoutJavaScriptExtension, 'index.tsx'),
  ];
  return candidates.find((candidate) => sourceFileSet.has(candidate));
}

function displayPath(file: string): string {
  return relative(repositoryRoot, file);
}
