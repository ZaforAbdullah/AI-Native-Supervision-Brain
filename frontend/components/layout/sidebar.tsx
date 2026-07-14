"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, Settings, Shield,
  LogOut, Play, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth, useUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/advisors", icon: Users, label: "Advisors" },
  { href: "/chat", icon: MessageSquare, label: "AI Assistant" },
  { href: "/analysis", icon: Play, label: "Analysis Runs" },
  { href: "/reports", icon: FileText, label: "Reports" },
];

const configItems = [
  { href: "/admin/rules", icon: Shield, label: "Risk Rules", adminOnly: true },
  { href: "/admin/settings", icon: Settings, label: "Settings", adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const renderLink = ({ href, icon: Icon, label, adminOnly }: (typeof navItems)[number] & { adminOnly?: boolean }) => {
    if (adminOnly && !user?.is_admin) return null;
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link key={href} href={href} className={cn("sidebar-link mb-0.5", active && "active")}>
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

  return (
    <aside className="w-[248px] h-screen bg-paper-sidebar border-r border-line-soft flex flex-col fixed left-0 top-0">
      <div className="px-[18px] py-5 border-b border-line-soft flex items-center gap-2.5">
        <div className="w-[34px] h-[34px] rounded-lg bg-ink-navy flex items-center justify-center gap-[3px] shrink-0">
          <span className="w-[3px] h-[10px] bg-accent-tan rounded-[1px]" />
          <span className="w-[3px] h-4 bg-paper rounded-[1px]" />
          <span className="w-[3px] h-[7px] bg-accent-slate rounded-[1px]" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-ink leading-tight">Supervision Brain</p>
          <p className="text-[10.5px] text-muted-label tracking-wide">AI RISK PLATFORM</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10.5px] font-semibold text-muted-faint uppercase tracking-wider mb-2 px-2">Navigation</p>
        {navItems.map(renderLink)}

        {configItems.some((i) => !i.adminOnly || user?.is_admin) && (
          <p className="text-[10.5px] font-semibold text-muted-faint uppercase tracking-wider mt-[18px] mb-2 px-2">Configuration</p>
        )}
        {configItems.map(renderLink)}
      </nav>

      <div className="px-3 py-3.5 border-t border-line-soft">
        {user && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-line flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-ink-navy">
                {user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink truncate">{user.full_name}</p>
              <p className="text-[11px] text-muted-label truncate">{user.is_admin ? "Administrator" : "Compliance Officer"}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-risk-critical hover:bg-risk-critical-bg transition-colors text-left"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
