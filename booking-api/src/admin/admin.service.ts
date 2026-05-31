import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, PlanTier, AppointmentStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async getPerformanceMetrics(timeframe: 'today' | 'week' | 'month') {
    const now = new Date();
    const startDate = new Date();

    if (timeframe === 'today') startDate.setHours(0, 0, 0, 0);
    else if (timeframe === 'week') startDate.setDate(now.getDate() - 7);
    else if (timeframe === 'month') startDate.setMonth(now.getMonth() - 1);

    const [transactions, businesses, appointments] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.business.findMany({
        include: { _count: { select: { appointments: true, users: true } } },
      }),
      this.prisma.appointment.findMany({
        where: { createdAt: { gte: startDate } },
        select: { status: true },
      }),
    ]);

    const revenue = transactions.reduce(
      (acc, t) => {
        if (t.type === TransactionType.SUBSCRIPTION) acc.subscription += t.amountCents;
        else if (t.type === TransactionType.COMMISSION) acc.commission += t.amountCents;
        else if (t.type === TransactionType.PROCESSING_FEE) acc.fees += t.amountCents;
        acc.total += t.amountCents;
        return acc;
      },
      { total: 0, subscription: 0, commission: 0, fees: 0 },
    );

    const activeSalons = businesses.filter((b) => !b.suspended).length;
    const completedAppts = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length;
    const totalAppts = appointments.length;
    const noShowRate = totalAppts > 0 ? (appointments.filter((a) => a.status === AppointmentStatus.NO_SHOW).length / totalAppts) * 100 : 0;

    return {
      revenue,
      tenants: {
        total: businesses.length,
        active: activeSalons,
        suspended: businesses.filter((b) => b.suspended).length,
      },
      velocity: {
        completed: completedAppts,
        noShowRate,
      },
    };
  }

  async getSalons() {
    return this.prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { staff: true, appointments: true } },
      },
    });
  }

  async updateSalon(id: string, data: { suspended?: boolean; plan?: PlanTier }) {
    return this.prisma.business.update({
      where: { id },
      data,
    });
  }

  async getTransactions() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { business: { select: { name: true } } },
    });
  }

  async getSystemHealth() {
    return [
      { name: 'API Latency', value: '45ms', status: 'HEALTHY' },
      { name: 'DB Connections', value: '12/100', status: 'HEALTHY' },
      { name: 'SMS Delivery Rate', value: '99.2%', status: 'HEALTHY' },
      { name: 'Redis Queue Depth', value: '0', status: 'HEALTHY' },
    ];
  }

  async impersonate(businessId: string) {
    const owner = await this.prisma.user.findFirst({
      where: { businessId, role: 'OWNER' },
    });

    if (!owner) throw new NotFoundException('Owner not found for this business');

    const payload = { sub: owner.id, email: owner.email, role: owner.role };
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    });

    return {
      accessToken,
      user: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        role: owner.role,
        businessId: owner.businessId,
      },
    };
  }
}
