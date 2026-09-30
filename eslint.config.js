// Konfigurasi ESLint untuk menangkap identifier yang tidak terdefinisi
// (no-undef) dan pelanggaran Rules of Hooks — dua kelas bug yang lolos dari
// build Vite tetapi mematikan aplikasi saat runtime.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'vendor/**', '*.config.js'],
  },
  {
    files: ['src/**/*.{js,jsx}', '*.jsx'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      // Yang paling penting: menangkap simbol yang dipakai tapi tidak diimpor
      // (UserMenuSheet, startAfter) sebelum sampai produksi.
      'no-undef': 'error',
      // Variabel tak terpakai: peringatan saja, tidak memblokir.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // JSX memakai identifier huruf besar; no-unused-vars perlu tahu itu dipakai.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
