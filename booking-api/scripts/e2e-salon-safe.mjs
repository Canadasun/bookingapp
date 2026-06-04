import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const API = process.env.API_URL || 'http://127.0.0.1:3001/api';
const WEB = process.env.WEB_URL || 'http://127.0.0.1:3000';
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || 'owner@demo-salon.com';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || 'password123';
const CLIENT = {
  name: process.env.E2E_CLIENT_NAME || 'Peter Mayeni',
  email: process.env.E2E_CLIENT_EMAIL || 'pmayeni1@icloud.com',
  phone: process.env.E2E_CLIENT_PHONE || '825 964 0641',
};

const prisma = new PrismaClient();
const stamp = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 17)}${Math.random().toString(36).slice(2, 6)}`;
const report = [];
let token = '';

function log(name, ok, detail = '') {
  report.push({ name, ok, detail });
  console.log(`${ok ? 'ok' : 'fail'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function request(path, { method = 'GET', body, auth = true, expected } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  const ok = expected ? expected.includes(res.status) : res.ok;
  if (!ok) {
    const msg = typeof data === 'object' && data ? JSON.stringify(data) : String(data);
    throw new Error(`${method} ${path} -> ${res.status}: ${msg}`);
  }
  return data;
}

async function page(path, expected = [200]) {
  const res = await fetch(`${WEB}${path}`, { redirect: 'manual' });
  if (!expected.includes(res.status)) throw new Error(`${path} -> ${res.status}`);
  return res.status;
}

function isoAtLocalNoon(daysFromNow = 5) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(15, 0, 0, 0); // stable UTC instant, later replaced by slot selection.
  return d.toISOString();
}

async function firstSlot(staffId, serviceId) {
  for (let i = 3; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyyMmDd = d.toISOString().slice(0, 10);
    const q = new URLSearchParams({
      staffId,
      serviceId,
      startDate: yyyyMmDd,
      endDate: yyyyMmDd,
      timezone: 'America/Edmonton',
    });
    const slots = await request(`/availability/slots?${q.toString()}`, { auth: false });
    if (slots.length) return slots[0];
  }
  throw new Error('No availability slots found in the next 14 days');
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function countQueue(appointmentId) {
  if (!process.env.REDIS_URL) return null;
  const queue = new Queue('notifications', { connection: { url: process.env.REDIS_URL } });
  try {
    const counts = await queue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
    const delayed = await queue.getDelayed();
    return {
      counts,
      appointmentDelayedJobs: delayed.filter((j) => JSON.stringify(j.data).includes(appointmentId)).map((j) => j.name),
    };
  } finally {
    await queue.close();
  }
}

async function main() {
  await page('/');
  await page('/login');
  await page('/book');
  log('web pages', true, 'home, login, and public book render');

  const health = await request('/healthz', { auth: false });
  log('api health', health.status === 'ok', `db=${health.details.database.status}, redis=${health.details.redis.status}`);

  const login = await request('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  token = login.accessToken;
  const businessId = login.user.businessId;
  log('owner login', true, `${login.user.email} (${login.user.role})`);

  const business = await request(`/businesses/${businessId}`);
  await request(`/businesses/${businessId}`, {
    method: 'PATCH',
    body: {
      minNoticeMinutes: 0,
      maxAdvanceDays: Math.max(business.maxAdvanceDays ?? 60, 60),
      allowClientReschedule: true,
      cancellationPolicy: business.cancellationPolicy || 'Please cancel at least 24 hours before your appointment.',
      plan: 'PRO',
    },
  });
  log('settings', true, 'business policies loaded and patched for test coverage');

  const category = await request(`/businesses/${businessId}/service-categories`, {
    method: 'POST',
    body: { name: `E2E Hair ${stamp}`, description: 'Safe test category', color: '#0ea5e9' },
  });
  const service = await request(`/businesses/${businessId}/services`, {
    method: 'POST',
    body: {
      name: `E2E Cut ${stamp}`,
      description: 'Safe booking flow test service',
      durationMinutes: 45,
      priceCents: 5500,
      bufferBeforeMin: 5,
      bufferAfterMin: 5,
      color: '#22c55e',
      categoryId: category.id,
    },
  });
  await request(`/businesses/${businessId}/services/${service.id}`, {
    method: 'PATCH',
    body: { description: 'Safe booking flow test service - updated' },
  });
  log('services', true, `category=${category.id}, service=${service.id}`);

  const staffInvite = await request(`/businesses/${businessId}/staff/invite`, {
    method: 'POST',
    body: {
      name: `E2E Stylist ${stamp}`,
      email: `e2e-stylist-${stamp}@demo-salon.com`,
      bio: 'Safe test stylist',
      serviceIds: [service.id],
    },
  });
  const staff = staffInvite.staff;
  await request(`/businesses/${businessId}/staff/${staff.id}/availability`, {
    method: 'POST',
    body: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '09:00', endTime: '17:00' })),
  });
  const timeOff = await request(`/businesses/${businessId}/staff/${staff.id}/time-off`, {
    method: 'POST',
    body: {
      startsAt: isoAtLocalNoon(20),
      endsAt: new Date(Date.parse(isoAtLocalNoon(20)) + 60 * 60 * 1000).toISOString(),
      reason: 'E2E add/delete test',
    },
  });
  await request(`/businesses/${businessId}/staff/${staff.id}/time-off/${timeOff.id}`, { method: 'DELETE' });
  log('staff', true, `staff=${staff.id}, availability set, time-off add/delete ok`);

  const slot = await firstSlot(staff.id, service.id);
  log('availability', true, `${slot.startsAtLocal}`);

  const client = await request(`/businesses/${businessId}/clients`, {
    method: 'POST',
    auth: false,
    body: { ...CLIENT, notes: `E2E booking ${stamp}` },
  });
  await request(`/businesses/${businessId}/clients/${client.id}`, {
    method: 'PATCH',
    body: { notes: `E2E booking ${stamp}; dashboard client update ok` },
  });
  await request(`/businesses/${businessId}/clients?search=${encodeURIComponent(CLIENT.email)}&page=1&limit=10`);
  log('clients', true, `${client.email}, matched=${client.matched === true}`);

  const appointment = await request(`/businesses/${businessId}/bookings`, {
    method: 'POST',
    auth: false,
    body: {
      staffId: staff.id,
      serviceId: service.id,
      clientId: client.id,
      startsAt: slot.startsAt,
      notes: `E2E public booking ${stamp}`,
    },
  });
  log('public booking', appointment.status === 'PENDING', `appointment=${appointment.id}`);

  await wait(1500);
  const confirmed = await request(`/businesses/${businessId}/bookings/${appointment.id}/confirm`, { method: 'PATCH' });
  log('appointment confirm', confirmed.status === 'CONFIRMED', confirmed.status);

  const edited = await request(`/businesses/${businessId}/bookings/${appointment.id}`, {
    method: 'PATCH',
    body: {
      clientName: CLIENT.name,
      clientEmail: CLIENT.email,
      clientPhone: CLIENT.phone,
      notes: `E2E dashboard edit ${stamp}`,
      notifyClient: true,
    },
  });
  log('appointment edit', edited.client.email === CLIENT.email, 'client detail update ok');

  await wait(3000);
  const deliveries = await request('/notifications/deliveries?limit=50');
  const appointmentDeliveries = deliveries.filter((d) => d.recipient === CLIENT.email);
  const notificationRows = await prisma.notificationLog.findMany({
    where: { appointmentId: appointment.id },
    orderBy: { sentAt: 'asc' },
  });
  const queueInfo = await countQueue(appointment.id);
  log('notifications/email', appointmentDeliveries.length > 0, `${appointmentDeliveries.map((d) => `${d.type}:${d.status}`).join(', ') || 'none'}`);
  log('notification log', notificationRows.length > 0, notificationRows.map((r) => `${r.type}:${r.status}`).join(', '));
  if (queueInfo) log('notification queue', true, JSON.stringify(queueInfo));

  await request(`/businesses/${businessId}/messages`);
  await request(`/businesses/${businessId}/clients/${client.id}/messages/reply`, {
    method: 'POST',
    body: { content: `E2E dashboard reply ${stamp}` },
  });
  log('messages', true, 'threads list and owner reply ok');

  const waitlist = await request(`/businesses/${businessId}/waitlist`, {
    method: 'POST',
    auth: false,
    body: { name: CLIENT.name, email: CLIENT.email, phone: CLIENT.phone, serviceId: service.id, staffId: staff.id, desiredDate: new Date().toISOString(), notes: `E2E waitlist ${stamp}` },
  });
  await request(`/businesses/${businessId}/waitlist`);
  await request(`/businesses/${businessId}/waitlist/${waitlist.id}`, { method: 'DELETE' });
  log('waitlist', true, `created/deleted ${waitlist.id}`);

  const offer = await request(`/businesses/${businessId}/offers`, {
    method: 'POST',
    body: { title: `E2E Offer ${stamp}`, description: 'Safe offer test', discount: '10%', active: true },
  });
  await request(`/businesses/${businessId}/offers/${offer.id}`, { method: 'PATCH', body: { active: false } });
  log('offers', true, offer.id);

  const giftCard = await request(`/businesses/${businessId}/gift-cards`, {
    method: 'POST',
    body: { amountCents: 2500, recipientName: CLIENT.name, recipientEmail: CLIENT.email, purchaserName: 'E2E Test', message: `Safe gift-card test ${stamp}` },
  });
  await request(`/businesses/${businessId}/gift-cards/balance?code=${encodeURIComponent(giftCard.code)}`, { auth: false });
  await request(`/businesses/${businessId}/gift-cards/redeem`, {
    method: 'POST',
    body: { code: giftCard.code, amountCents: 500, appointmentId: appointment.id },
  });
  log('gift cards', true, `${giftCard.code} issued and partially redeemed`);

  const pkg = await request(`/businesses/${businessId}/packages`, {
    method: 'POST',
    body: { name: `E2E Package ${stamp}`, serviceId: service.id, credits: 2, priceCents: 9000 },
  });
  const issued = await request(`/businesses/${businessId}/packages/issued`, {
    method: 'POST',
    body: { clientId: client.id, packageId: pkg.id },
  });
  await request(`/businesses/${businessId}/packages/issued/${issued.id}/redeem`, {
    method: 'POST',
    body: { appointmentId: appointment.id },
  });
  log('packages', true, `package=${pkg.id}, issued=${issued.id}`);

  const campaign = await request(`/businesses/${businessId}/campaigns`, {
    method: 'POST',
    body: { name: `E2E Campaign ${stamp}`, channel: 'EMAIL', audience: 'ALL', subject: 'E2E draft', body: 'Hello {name}, test from {business}' },
  });
  const audience = await request(`/businesses/${businessId}/campaigns/audience?channel=EMAIL&audience=ALL`);
  log('marketing', true, `draft=${campaign.id}, audience=${audience.count}`);

  const completed = await request(`/businesses/${businessId}/bookings/${appointment.id}/status`, {
    method: 'PATCH',
    body: { status: 'COMPLETED' },
  });
  log('appointment complete', completed.status === 'COMPLETED', completed.status);

  const review = await request(`/businesses/${businessId}/reviews`, {
    method: 'POST',
    auth: false,
    body: { appointmentId: appointment.id, rating: 5, comment: `E2E review ${stamp}`, token: appointment.manageToken },
  });
  await request(`/businesses/${businessId}/reviews/all`);
  await request(`/businesses/${businessId}/reviews/${review.id}`, { method: 'PATCH', body: { published: false } });
  log('reviews', true, review.id);

  await request('/payments');
  await request('/subscriptions');
  await request('/referrals');
  await request('/calendar-sync/google/status');
  await request('/notifications');
  await request('/notifications/unread-count');
  log('transactions/billing/calendar/notifications', true, 'list/status endpoints ok');

  const appointments = await request(`/businesses/${businessId}/bookings?page=1&limit=20`);
  const found = appointments.data.some((a) => a.id === appointment.id);
  log('dashboard appointment list', found, `contains appointment=${found}`);

  const failures = report.filter((r) => !r.ok);
  console.log('\nSUMMARY');
  console.log(JSON.stringify({
    businessId,
    serviceId: service.id,
    staffId: staff.id,
    clientId: client.id,
    appointmentId: appointment.id,
    appointmentStatus: confirmed.status,
    deliveryCountForClientEmail: appointmentDeliveries.length,
    failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`\nE2E FAILED: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
