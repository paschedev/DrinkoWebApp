import { UserRole } from '@prisma/client';

// Usuario de la sesión, disponible en los controladores protegidos.
export type AuthUser = {
  id: string;
  organizationId: string | null;
  role: UserRole;
  name: string;
};
