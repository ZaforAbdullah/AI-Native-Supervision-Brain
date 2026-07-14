"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";
import { useToast } from "@/components/ui/toast-provider";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      setToken(data.access_token);
      setUser(data.user);
      showToast("Signed in successfully", "success");
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || "Invalid credentials", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-navy-deep flex items-center justify-center p-6 relative font-sans">
      <div className="absolute top-0 left-0 right-0 h-1 bg-risk-critical" />
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-1 w-14 h-14 rounded-[10px] bg-ink-navy mb-[18px]">
            <span className="w-1 h-3.5 bg-accent-tan rounded-[1px]" />
            <span className="w-1 h-[22px] bg-paper rounded-[1px]" />
            <span className="w-1 h-2.5 bg-accent-slate rounded-[1px]" />
          </div>
          <h1 className="text-[22px] font-semibold text-paper tracking-tight">Supervision Brain</h1>
          <p className="text-accent-slate mt-1.5 text-[13px] tracking-wide">NETWORK RISK ANALYSIS PLATFORM</p>
        </div>

        <div className="bg-paper-sidebar rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.35)] p-8">
          <h2 className="text-base font-semibold text-ink mb-1">Sign in to continue</h2>
          <p className="text-[13px] text-muted mb-6">Compliance & supervision teams only</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-muted-strong mb-1.5 uppercase tracking-wide">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-faint" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-line-input rounded-md text-sm bg-white text-ink outline-none focus:ring-2 focus:ring-ink-navy/30 focus:border-ink-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-strong mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-faint" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 border border-line-input rounded-md text-sm bg-white text-ink outline-none focus:ring-2 focus:ring-ink-navy/30 focus:border-ink-navy"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-faint hover:text-muted"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-[11px] bg-ink-navy hover:bg-ink-navy-dark disabled:opacity-60 text-white font-semibold rounded-md text-sm transition-colors"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-5 p-3.5 bg-paper-subtle border border-line-soft rounded-md">
            <p className="text-[11px] font-semibold text-muted-strong mb-2 tracking-wide">DEMO CREDENTIALS</p>
            <div className="space-y-2">
              {[
                { role: "Administrator", email: "admin@supervision-brain.local", password: "Admin@1234!" },
                { role: "Compliance Officer", email: "compliance@supervision-brain.local", password: "Comply@1234!" },
                { role: "Supervision Manager", email: "supervisor@supervision-brain.local", password: "Super@1234!" },
              ].map(({ role, email, password }) => (
                <div key={email} className="text-[11px]">
                  <p className="text-muted-strong font-semibold">{role}</p>
                  <p className="text-muted font-mono">{email} · {password}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-accent-slate mt-[22px] tracking-wide">
          SUPERVISION BRAIN POC · AUTHORISED ACCESS ONLY
        </p>
      </div>
    </div>
  );
}
