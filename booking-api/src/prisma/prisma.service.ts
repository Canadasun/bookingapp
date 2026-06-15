import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from '../common/util/tenant-context';
import { encryptProviderToken } from '../common/util/provider-token-crypto';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private _extendedClient: any;

  constructor() {
    super();
    this._extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const ctx = tenantContext.getStore();
            const tenantModels = [
              'Appointment', 'BusinessClosure', 'BusinessHours', 'Campaign', 'Client',
              'ClientMembership', 'ClientPackage', 'DataErasureRequest', 'FollowUpPolicy',
              'GiftCard', 'GoogleCalendarConnection', 'Invoice', 'Location', 'MembershipPlan',
              'Message', 'MessageThreadState', 'NotificationDelivery', 'Offer', 'Package',
              'Payment', 'PrivacyConsent', 'PromoCode', 'Refund', 'Resource', 'Review',
              'Service', 'ServiceCategory', 'ServiceDue', 'SquareConnection', 'Staff',
              'StaffTask', 'Subscription', 'SystemError', 'Transaction', 'UploadedFile',
              'WaitlistEntry',
            ];
            
            if (ctx?.businessId && tenantModels.includes(model)) {
              const a = args as any;
              if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'].includes(operation)) {
                a.where = { ...a.where, businessId: ctx.businessId };
              } else if (operation === 'findUnique') {
                // findUnique only allows querying by unique fields. We force it 
                // to findFirst so we can append the businessId filter.
                return (this as any).findFirst({
                  where: { ...a.where, businessId: ctx.businessId },
                  include: a.include,
                  select: a.select,
                });
              } else if (operation === 'create') {
                a.data = { ...a.data, businessId: ctx.businessId };
              } else if (operation === 'upsert') {
                a.create = { ...a.create, businessId: ctx.businessId };
                a.update = { ...a.update, businessId: ctx.businessId };
                // We don't touch upsert.where for the same unique-index reason as update/delete
              }
            }
            return query(args);
          },
        },
      },
    });

    return new Proxy(this, {
      get: (target, prop) => {
        const value = prop in this._extendedClient ? (this._extendedClient as any)[prop] : (target as any)[prop];
        if (typeof value === 'function') {
          return value.bind(prop in this._extendedClient ? this._extendedClient : target);
        }
        return value;
      },
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
