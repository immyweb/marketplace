import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl">Privacy Notice</h1>
      <p className="mt-8 text-muted-foreground">Content coming soon.</p>
    </>
  );
}
