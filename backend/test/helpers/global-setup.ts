import { execSync } from 'child_process';
import { TEST_DATABASE_URL } from './test-env';

// Aplica las migraciones en la base de tests antes de correr las pruebas.
export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'ignore',
  });
}
