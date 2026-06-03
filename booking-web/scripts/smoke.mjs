const webUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const checks = [
  { name: 'web home', url: `${webUrl}/` },
  { name: 'web login', url: `${webUrl}/login` },
  { name: 'web register', url: `${webUrl}/register` },
  { name: 'web public book', url: `${webUrl}/book` },
  { name: 'api health', url: `${apiUrl}/healthz` },
];

async function check({ name, url }) {
  const started = Date.now();
  const res = await fetch(url, { redirect: 'manual' });
  const ms = Date.now() - started;
  if (res.status >= 200 && res.status < 400) {
    console.log(`ok ${name} ${res.status} ${ms}ms`);
    return;
  }
  throw new Error(`${name} returned HTTP ${res.status} from ${url}`);
}

for (const item of checks) {
  await check(item);
}

console.log('smoke checks passed');
