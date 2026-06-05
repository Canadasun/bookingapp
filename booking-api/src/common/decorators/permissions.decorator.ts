import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
// Endpoints decorated with @RequirePermissions(...) are reachable by OWNER/ADMIN
// always, plus STAFF whose Staff.permissions include every listed permission.
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
