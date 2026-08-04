import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const frontendLayers = [
  'application',
  'domain',
  'services',
  'state',
  'hooks',
  'adapters',
  'features',
  'components',
  'pages',
];

// Feature modules contain pure use cases and view models. React adapters own
// the UI wiring and receive their use cases through the provider.
const allowedLayerDependencies = {
  // The application layer is the composition root for use cases and adapters,
  // not a presentation entry point. Keep UI wiring in the page/component
  // layers so the dependency direction remains one-way.
  application: ['application', 'domain', 'services', 'features'],
  domain: ['domain'],
  services: ['domain', 'services'],
  state: ['application', 'domain', 'features', 'state'],
  hooks: ['application', 'domain', 'features', 'hooks', 'services', 'state'],
  adapters: ['adapters', 'domain', 'features', 'hooks', 'services', 'state'],
  features: ['domain', 'features'],
  components: ['adapters', 'components', 'domain', 'features', 'hooks', 'services', 'state'],
  pages: ['adapters', 'components', 'domain', 'features', 'hooks', 'pages', 'services', 'state'],
};

const boundaryMessages = {
  application: {
    state: 'The application layer must not depend on UI state.',
    hooks: 'The application layer must not depend on React hooks.',
    components: 'The application layer must not depend on presentation components.',
    pages: 'The application layer must not depend on pages.',
  },
  domain: {
    application: 'The domain layer must not depend on the composition root. Use a domain contract.',
    services: 'The domain layer must not depend on services. Use a domain contract or application port.',
    state: 'The domain layer must not depend on state. Pass state values through a domain contract.',
    hooks: 'The domain layer must not depend on React hooks.',
    features: 'The domain layer must not depend on application features.',
    components: 'The domain layer must not depend on presentation components.',
    pages: 'The domain layer must not depend on pages.',
  },
  services: {
    application: 'Services must not depend on the composition root.',
    state: 'Services must not depend on UI state.',
    hooks: 'Services must not depend on React hooks.',
    features: 'Services must not depend on application features.',
    components: 'Services must not depend on presentation components.',
    pages: 'Services must not depend on pages.',
  },
  state: {
    hooks: 'State must not depend on React hooks.',
    services: 'State must use an application or feature authentication use case instead of services.',
    components: 'State must not depend on presentation components.',
    pages: 'State must not depend on pages.',
  },
  hooks: {
    components: 'Hooks must not depend on presentation components.',
    pages: 'Hooks must not depend on pages.',
  },
  adapters: {
    application: 'React adapters must consume feature use cases through the provider.',
    components: 'React adapters must not depend on presentation components.',
    pages: 'React adapters must not depend on pages.',
  },
  features: {
    application: 'Features must depend on ports, not the composition root.',
    services: 'Features must depend on ports, not infrastructure services.',
    components: 'Features must not depend on presentation components.',
    pages: 'Features must not depend on pages.',
  },
  components: {
    application: 'Components must consume feature view models, not the composition root.',
    services: 'Move service calls behind an application or feature use case.',
    pages: 'Components must not depend on pages.',
  },
  pages: {
    application: 'Pages must consume feature view models, not the composition root.',
    services: 'Move service calls behind an application or feature use case.',
  },
};

// Import sources are relative today and feature folders can be nested. A
// regex keeps the boundary effective if another nested folder is introduced
// without having to maintain a list of every possible ../ depth. The optional
// react/ segment also closes the equivalent path that climbs back to src.
const restrictLayerImport = (layer, message) => ({
  regex: `^(?:\\.\\./)+(?:react/)?${layer}(?:/|$)`,
  message,
});

const layerBoundaryRestrictions = (sourceLayer) => frontendLayers
  .filter((targetLayer) => !allowedLayerDependencies[sourceLayer].includes(targetLayer))
  .map((targetLayer) => restrictLayerImport(
    targetLayer,
    boundaryMessages[sourceLayer][targetLayer],
  ));

const layerBoundaryConfig = (sourceLayer) => ({
  files: [`src/react/${sourceLayer}/**/*.{ts,tsx}`],
  // Unit tests are explicit fixture seams: they may mock a lower-level port
  // directly. Production import cycles and layer edges are checked below.
  ignores: ['**/*.test*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: layerBoundaryRestrictions(sourceLayer),
    }],
  },
});

// Server application modules expose contracts and ports only. HTTP, provider,
// and transport modules are infrastructure and must not leak into that layer.
const serverApplicationBoundaryConfig = {
  files: ['server/application/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        restrictLayerImport('http', 'Server application must not depend on HTTP transport.'),
        restrictLayerImport('preview', 'Server application must not depend on provider implementations.'),
        restrictLayerImport('transport', 'Server application must not depend on transport adapters.'),
        restrictLayerImport('tiktok', 'Server application must use a port instead of a provider module.'),
        restrictLayerImport('publicHttp', 'Server application must not depend on HTTP transport.'),
        restrictLayerImport('publicAddress', 'Server application must not depend on network policy.'),
      ],
    }],
  },
};

const serverHttpBoundaryConfig = {
  files: ['server/http/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          regex: '^(?:\\.\\./)+preview/(?!errors(?:[/.]|$))',
          message: 'HTTP transport must call application use cases, not providers.',
        },
        restrictLayerImport('tiktok', 'HTTP transport must call application use cases, not providers.'),
        restrictLayerImport('publicHttp', 'HTTP routing must not bypass the application boundary.'),
        restrictLayerImport('publicAddress', 'HTTP routing must not depend on network policy.'),
      ],
    }],
  },
};

const serverTransportBoundaryConfig = {
  files: ['server/transport/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [restrictLayerImport('http', 'Transport adapters must not depend on HTTP routing.')],
    }],
  },
};

export default tseslint.config(
  {
    ignores: [
      '.agents',
      '.codex',
      'dist',
      'dist-server',
      'node_modules',
      'playwright-report',
      'test-results',
      'coverage',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      sourceType: 'module',
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['vite.config.ts', 'playwright.config.ts', 'server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...frontendLayers.map(layerBoundaryConfig),
  serverApplicationBoundaryConfig,
  serverHttpBoundaryConfig,
  serverTransportBoundaryConfig,
);
