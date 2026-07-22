import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': 'warn',
      eqeqeq: 'error',
      // Plugins do Fastify são async por contrato (retornam Promise mesmo sem await interno).
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['scripts/**', 'prisma/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
