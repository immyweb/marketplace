import { headers } from "next/headers";
import { API_URL } from "@/lib/api";

export interface ServerSession {
  session: { id: string; userId: string; expiresAt: string };
  user: { id: string; name: string; email: string };
}

export async function getServerSession(): Promise<ServerSession | null> {
  const cookie = (await headers()).get("cookie");
  const res = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data ?? null;
}
