import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
  { ignores: ['dist/**', 'dist-ssr/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,ts,vue}'],
    plugins: { '@stylistic': stylistic },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      // `value == null` намеренно проверяет и null, и undefined (старые снимки заказа).
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-debugger': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
  {
    files: ['*.{ts,mjs}', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/no-v-html': 'error',
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/no-mutating-props': ['error', { shallowOnly: false }],
      'vue/no-unused-refs': 'error',
    },
  },
)
