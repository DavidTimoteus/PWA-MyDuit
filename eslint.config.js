// Konfigurasi ESLint untuk menangkap identifier yang tidak terdefinisi
// (no-undef) dan pelanggaran Rules of Hooks — dua kelas bug yang lolos dari
// build Vite tetapi mematikan aplikasi saat runtime.
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
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
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      // Yang paling penting: menangkap simbol yang dipakai tapi tidak diimpor
      // (UserMenuSheet, startAfter) sebelum sampai produksi.
      'no-undef': 'error',
      // TANPA rule ini, komponen yang dipakai sebagai <Nama /> di JSX dilaporkan
      // "defined but never used" (false positive) — sehingga import yang BENAR-
      // BENAR mati tidak bisa dibedakan dari noise. Itu persis kondisi yang dulu
      // meloloskan bug UserMenuSheet. Plugin react membuat no-unused-vars sadar
      // pemakaian di JSX.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off', // React 19: JSX runtime otomatis, tak perlu import React
      // Variabel tak terpakai: peringatan saja, tidak memblokir.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
