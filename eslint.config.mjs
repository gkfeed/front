import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// The frontend currently has no path aliases; these are the relative import
// depths used by the existing root-level and one-level nested feature folders.
const relativeLayerImports = (layer) => [
  `../${layer}`,
  `../${layer}/**`,
  `../../${layer}`,
  `../../${layer}/**`,
  `../../../${layer}`,
  `../../../${layer}/**`,
];

const restrictLayerImport = (layer, message) => ({
  group: relativeLayerImports(layer),
  message,
});

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
        patterns: [
          restrictLayerImport('services', 'The domain layer must not depend on services. Use a domain contract or application port.'),
          restrictLayerImport('state', 'The domain layer must not depend on state. Pass state values through a domain contract.'),
          restrictLayerImport('hooks', 'The domain layer must not depend on React hooks.'),
          restrictLayerImport('components', 'The domain layer must not depend on presentation components.'),
          restrictLayerImport('pages', 'The domain layer must not depend on pages.'),
          restrictLayerImport('features', 'The domain layer must not depend on application features.'),
        ],
      }],
    },
  },
  {
    files: ['src/react/services/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          restrictLayerImport('state', 'Services must not depend on UI state.'),
          restrictLayerImport('hooks', 'Services must not depend on React hooks.'),
          restrictLayerImport('components', 'Services must not depend on presentation components.'),
          restrictLayerImport('pages', 'Services must not depend on pages.'),
          restrictLayerImport('features', 'Services must not depend on application features.'),
        ],
      }],
    },
  },
  {
    files: ['src/react/state/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          restrictLayerImport('hooks', 'State must not depend on React hooks.'),
          restrictLayerImport('components', 'State must not depend on presentation components.'),
          restrictLayerImport('pages', 'State must not depend on pages.'),
          restrictLayerImport('services', 'State must use an application or feature authentication use case instead of services.'),
        ],
      }],
    },
  },
  {
    files: ['src/react/hooks/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          restrictLayerImport('components', 'Hooks must not depend on presentation components.'),
          restrictLayerImport('pages', 'Hooks must not depend on pages.'),
        ],
      }],
    },
  },
  {
    files: ['src/react/features/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          restrictLayerImport('components', 'Features must not depend on presentation components.'),
          restrictLayerImport('pages', 'Features must not depend on pages.'),
        ],
      }],
    },
  },
  {
    files: ['src/react/components/**/*.{ts,tsx}', 'src/react/pages/**/*.{ts,tsx}'],
    ignores: ['**/*.test*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          restrictLayerImport('services', 'Move service calls behind an application or feature use case.'),
        ],
      }],
    },
  },
);
