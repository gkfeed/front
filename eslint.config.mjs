import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const frontendLayers = ['domain', 'services', 'state', 'hooks', 'features', 'components', 'pages'];

// Features currently contain both application use cases and feature-specific
// hooks. Keep that transition explicit while preventing presentation layers
// from reaching infrastructure directly.
const allowedLayerDependencies = {
  domain: ['domain'],
  services: ['domain', 'services'],
  state: ['domain', 'features', 'state'],
  hooks: ['domain', 'features', 'hooks', 'state'],
  features: ['domain', 'features', 'hooks', 'services', 'state'],
  components: ['components', 'domain', 'features', 'hooks', 'state'],
  pages: ['components', 'domain', 'features', 'hooks', 'pages', 'state'],
};

const boundaryMessages = {
  domain: {
    services: 'The domain layer must not depend on services. Use a domain contract or application port.',
    state: 'The domain layer must not depend on state. Pass state values through a domain contract.',
    hooks: 'The domain layer must not depend on React hooks.',
    features: 'The domain layer must not depend on application features.',
    components: 'The domain layer must not depend on presentation components.',
    pages: 'The domain layer must not depend on pages.',
  },
  services: {
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
    services: 'Hooks must call application or feature use cases instead of services.',
    components: 'Hooks must not depend on presentation components.',
    pages: 'Hooks must not depend on pages.',
  },
  features: {
    components: 'Features must not depend on presentation components.',
    pages: 'Features must not depend on pages.',
  },
  components: {
    services: 'Move service calls behind an application or feature use case.',
    pages: 'Components must not depend on pages.',
  },
  pages: {
    services: 'Move service calls behind an application or feature use case.',
  },
};

// Import sources are relative today and feature folders can be nested. A
// regex keeps the boundary effective if another nested folder is introduced.
const restrictLayerImport = (layer, message) => ({
  regex: `^(?:\\.\\./)+${layer}(?:/|$)`,
  message,
});

const layerBoundaryRestrictions = (sourceLayer) => frontendLayers
  .filter((targetLayer) => !allowedLayerDependencies[sourceLayer].includes(targetLayer))
  .map((targetLayer) => restrictLayerImport(
    targetLayer,
    boundaryMessages[sourceLayer][targetLayer],
  ));

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
    files: ['src/react/domain/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layerBoundaryRestrictions('domain'),
      }],
    },
  },
  {
    files: ['src/react/services/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layerBoundaryRestrictions('services'),
      }],
    },
  },
  {
    files: ['src/react/state/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layerBoundaryRestrictions('state'),
      }],
    },
  },
  {
    files: ['src/react/hooks/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layerBoundaryRestrictions('hooks'),
      }],
    },
  },
  {
    files: ['src/react/features/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layerBoundaryRestrictions('features'),
      }],
    },
  },
  {
    files: ['src/react/components/**/*.{ts,tsx}', 'src/react/pages/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layerBoundaryRestrictions('components'),
      }],
    },
  },
  {
    files: ['src/react/pages/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: layerBoundaryRestrictions('pages'),
      }],
    },
  },
);
