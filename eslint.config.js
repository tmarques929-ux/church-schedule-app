import nextConfig from 'eslint-config-next';

const customRulesForTypescript = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  }
};

export default [...nextConfig, customRulesForTypescript];
