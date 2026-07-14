"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "./sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 ml-[248px] min-h-screen">
        <div className="px-8 py-7 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
