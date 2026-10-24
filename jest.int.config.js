/** Tests de integración con Testcontainers (Postgres de infra/postgres). */
module.exports = {
  ...require('./jest.config'),
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
  testTimeout: 180_000,
};
