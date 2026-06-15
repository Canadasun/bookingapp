import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from '../common/util/tenant-context';
import { encryptProviderToken } from '../common/util/provider-token-crypto';

export const TENANT_MODELS = [
  'Appointment', 'BusinessClosure', 'BusinessHours', 'Campaign', 'Client',
  'ClientMembership', 'ClientPackage', 'DataErasureRequest', 'FollowUpPolicy',
  'GiftCard', 'GoogleCalendarConnection', 'Invoice', 'Location', 'MembershipPlan',
  'Message', 'MessageThreadState', 'NotificationDelivery', 'Offer', 'Package',
  'Payment', 'PrivacyConsent', 'PromoCode', 'Refund', 'Resource', 'Review',
  'Service', 'ServiceCategory', 'ServiceDue', 'SquareConnection', 'Staff',
  'StaffTask', 'Subscription', 'SystemError', 'Transaction', 'UploadedFile',
  'WaitlistEntry',
] as const;

export function scopeTenantArgs(model: string, operation: string, args: any, businessId: string) {
  if (!TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) return args;
  const scoped = args ?? {};
  if ([
    'findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow',
    'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
  ].includes(operation)) {
    scoped.where = { ...scoped.where, businessId };
  }
  if (operation === 'create') {
    scoped.data = { ...scoped.data, businessId };
  }
  if (operation === 'createMany') {
    const rows: Record<string, unknown>[] = Array.isArray(scoped.data) ? scoped.data : [scoped.data];
    scoped.data = rows.map((row: Record<string, unknown>) => ({ ...row, businessId }));
  }
  if (operation === 'upsert') {
    scoped.create = { ...scoped.create, businessId };
    scoped.update = { ...scoped.update, businessId };
  }
  return scoped;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    this.$use(async (params, next) => {
      const ctx = tenantContext.getStore();
      if (ctx?.businessId && params.model) {
        params.args = scopeTenantArgs(params.model, params.action, params.args, ctx.businessId);
      }
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
    const [googleConnections, squareConnections] = await Promise.all([
      this.googleCalendarConnection.findMany({ select: { id: true, accessToken: true, refreshToken: true } }),
      this.squareConnection.findMany({ select: { id: true, accessToken: true, refreshToken: true } }),
    ]);
    await this.$transaction([
      ...googleConnections
        .filter((connection) => !connection.refreshToken.startsWith('enc:v1:') || (connection.accessToken && !connection.accessToken.startsWith('enc:v1:')))
        .map((connection) => this.googleCalendarConnection.update({
          where: { id: connection.id },
          data: {
            refreshToken: encryptProviderToken(connection.refreshToken),
            ...(connection.accessToken ? { accessToken: encryptProviderToken(connection.accessToken) } : {}),
          },
        })),
      ...squareConnections
        .filter((connection) => !connection.refreshToken.startsWith('enc:v1:') || !connection.accessToken.startsWith('enc:v1:'))
        .map((connection) => this.squareConnection.update({
          where: { id: connection.id },
          data: {
            refreshToken: encryptProviderToken(connection.refreshToken),
            accessToken: encryptProviderToken(connection.accessToken),
          },
        })),
    ]);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
