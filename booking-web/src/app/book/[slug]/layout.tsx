import type { Metadata } from "next";

const API = (process.env.API_INTERNAL_URL ?? "http://localhost:3001") + "/api";

async function getBusinessName(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/businesses/slug/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const b = (await res.json()) as { name?: string };
    return b?.name ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = (await getBusinessName(slug)) ?? "an appointment";
  const title = name === "an appointment" ? "Book an appointment" : `Book at ${name}`;
  const description = `Book an appointment online at ${name}.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
