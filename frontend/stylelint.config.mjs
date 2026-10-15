export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'dist-ssr/**', 'coverage/**', 'node_modules/**'],
  overrides: [{ files: ['**/*.vue'], customSyntax: 'postcss-html' }],
  rules: {
    'declaration-no-important': true,
    'selector-max-id': 0,
    'selector-class-pattern': '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
    'custom-property-pattern': '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['deep', 'global', 'slotted'] }],
    'function-no-unknown': [true, { ignoreFunctions: ['v-bind'] }],
  },
}
