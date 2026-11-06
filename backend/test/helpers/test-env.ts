// Los tests usan su propia base para no tocar los datos de desarrollo.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://drinko:drinko@localhost:5433/drinko_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;
