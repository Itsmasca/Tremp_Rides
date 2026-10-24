// Unit: `npm test` (test/**/*.spec.ts). Integración: `npm run test:int` (jest.int.config.js, requiere Docker).
// NestJS 12 es sólo ESM: los scripts corren Jest con --experimental-vm-modules para que pueda hacer require() de ESM.
const { readFileSync } = require('node:fs');

module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  transform: { '^.+\.ts$': ['@swc/jest', { ...JSON.parse(readFileSync('.swcrc', 'utf8')), swcrc: false }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
};
