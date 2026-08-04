import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
          {
            group: ['../services/**', '../../services/**', '../../../services/**'],
            message: 'The domain layer must not depend on services. Use a domain contract or application port.',
          },
          {
            group: ['../state/**', '../../state/**', '../../../state/**'],
            message: 'The domain layer must not depend on state. Pass state values through a domain contract.',
          },
          {
            group: ['../hooks/**', '../../hooks/**', '../../../hooks/**'],
            message: 'The domain layer must not depend on React hooks.',
          },
          {
            group: ['../components/**', '../../components/**', '../../../components/**'],
            message: 'The domain layer must not depend on presentation components.',
          },
          {
            group: ['../pages/**', '../../pages/**', '../../../pages/**'],
            message: 'The domain layer must not depend on pages.',
          },
          {
            group: ['../features/**', '../../features/**', '../../../features/**'],
            message: 'The domain layer must not depend on application features.',
          },
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
          {
            group: ['../state/**', '../../state/**', '../../../state/**'],
            message: 'Services must not depend on UI state.',
          },
          {
            group: ['../hooks/**', '../../hooks/**', '../../../hooks/**'],
            message: 'Services must not depend on React hooks.',
          },
          {
            group: ['../components/**', '../../components/**', '../../../components/**'],
            message: 'Services must not depend on presentation components.',
          },
          {
            group: ['../pages/**', '../../pages/**', '../../../pages/**'],
            message: 'Services must not depend on pages.',
          },
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
          {
            group: ['../hooks/**', '../../hooks/**', '../../../hooks/**'],
            message: 'State must not depend on React hooks.',
          },
          {
            group: ['../components/**', '../../components/**', '../../../components/**'],
            message: 'State must not depend on presentation components.',
          },
          {
            group: ['../pages/**', '../../pages/**', '../../../pages/**'],
            message: 'State must not depend on pages.',
          },
          {
            group: ['../services/**', '../../services/**', '../../../services/**'],
            message: 'State must use an application or feature authentication use case instead of services.',
          },
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
          {
            group: ['../components/**', '../../components/**', '../../../components/**'],
            message: 'Hooks must not depend on presentation components.',
          },
          {
            group: ['../pages/**', '../../pages/**', '../../../pages/**'],
            message: 'Hooks must not depend on pages.',
          },
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
          {
            group: ['../components/**', '../../components/**', '../../../components/**'],
            message: 'Features must not depend on presentation components.',
          },
          {
            group: ['../pages/**', '../../pages/**', '../../../pages/**'],
            message: 'Features must not depend on pages.',
          },
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
          {
            group: ['../services/**', '../../services/**', '../../../services/**'],
            message: 'Move service calls behind an application or feature use case.',
          },
        ],
      }],
    },
  },
);
