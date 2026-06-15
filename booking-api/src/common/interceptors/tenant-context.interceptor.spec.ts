import { firstValueFrom, of } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { tenantContext } from '../util/tenant-context';

describe('TenantContextInterceptor', () => {
  it('preserves tenant context through observable execution', async () => {
    const interceptor = new TenantContextInterceptor();
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'OWNER', businessId: 'biz-1' } }) }),
    } as any;

    const businessId = await firstValueFrom(interceptor.intercept(context, {
      handle: () => of(tenantContext.getStore()?.businessId),
    }));

    expect(businessId).toBe('biz-1');
  });

  it('does not tenant-scope platform administrators', async () => {
    const interceptor = new TenantContextInterceptor();
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'ADMIN', businessId: 'biz-1' } }) }),
    } as any;

    const businessId = await firstValueFrom(interceptor.intercept(context, {
      handle: () => of(tenantContext.getStore()?.businessId ?? null),
    }));

    expect(businessId).toBeNull();
  });
});
