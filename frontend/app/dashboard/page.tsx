"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi, analysisApi, ingestionApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { RiskBadge } from "@/components/ui/risk-badge";
import { formatDateTime, riskGradeBgClass } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";
import { Database, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const RISK_COLORS = { critical: "#8c2b1f", high: "#c98a4a", medium: "#c7ad4e", low: "#5c8368" };

export default function DashboardPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.stats().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => analysisApi.trigger({ trigger: "manual" }),
    onSuccess: () => {
      showToast("Analysis triggered — running in background", "success");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["dashboard-stats"] }), 5000);
    },
    onError: () => showToast("Failed to trigger analysis", "error"),
  });

  const sampleMutation = useMutation({
    mutationFn: () => ingestionApi.loadSample(),
    onSuccess: () => {
      showToast("Sample data loaded successfully", "success");
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: () => showToast("Failed to load sample data", "error"),
  });

  const pieData = stats
    ? [
        { name: "Critical", value: stats.critical_risk_count, color: RISK_COLORS.critical },
        { name: "High", value: stats.high_risk_count, color: RISK_COLORS.high },
        { name: "Medium", value: stats.medium_risk_count, color: RISK_COLORS.medium },
        { name: "Low", value: stats.low_risk_count, color: RISK_COLORS.low },
      ].filter((d) => d.value > 0)
    : [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 text-ink-navy animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-3.5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Supervision Dashboard</h1>
            <p className="text-[13px] text-muted mt-1">
              Network Risk Analysis · Last run: <span className="font-mono">{formatDateTime(stats?.last_analysis_run)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stats?.total_advisors === 0 && (
              <button
                onClick={() => sampleMutation.mutate()}
                disabled={sampleMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-line rounded-md text-ink text-[13px] font-semibold hover:bg-paper-subtle transition-colors"
              >
                <Database className="w-4 h-4" />
                Load Sample Data
              </button>
            )}
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark disabled:opacity-60 text-white rounded-md text-[13px] font-semibold transition-colors"
            >
              {triggerMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Run Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            title="Critical Risk"
            value={stats?.critical_risk_count ?? 0}
            valueClassName="text-risk-critical"
            subtitle="Requires immediate action"
          />
          <StatCard
            title="High Risk"
            value={stats?.high_risk_count ?? 0}
            valueClassName="text-risk-high"
            subtitle="Enhanced review needed"
          />
          <StatCard
            title="Active Advisors"
            value={stats?.active_advisors ?? 0}
            subtitle={`${stats?.total_advisors ?? 0} total registered`}
          />
          <StatCard
            title="Reports Generated"
            value={stats?.total_reports ?? 0}
            valueClassName="text-[#4c4a63]"
            subtitle="Supervision reports"
          />
        </div>

        <div className="grid grid-cols-3 gap-3.5">
          <div className="card px-4 py-3.5">
            <p className="text-[10.5px] font-semibold text-muted-label uppercase tracking-wider mb-1">Lender Concentration Alerts</p>
            <p className="text-xl font-bold font-mono text-ink">{stats?.lender_concentration_alerts ?? 0}</p>
          </div>
          <div className="card px-4 py-3.5">
            <p className="text-[10.5px] font-semibold text-muted-label uppercase tracking-wider mb-1">Provider Concentration Alerts</p>
            <p className="text-xl font-bold font-mono text-ink">{stats?.provider_concentration_alerts ?? 0}</p>
          </div>
          <div className="card px-4 py-3.5">
            <p className="text-[10.5px] font-semibold text-muted-label uppercase tracking-wider mb-1">EFM Flags Active</p>
            <p className="text-xl font-bold font-mono text-risk-critical">{stats?.efm_flags_active ?? 0}</p>
            <p className="text-[10.5px] text-risk-critical mt-0.5">Enhanced Financial Monitoring</p>
          </div>
        </div>

        <div className="grid grid-cols-[1.3fr_1fr] gap-3.5">
          <div className="card p-[18px]">
            <h2 className="text-[13px] font-semibold text-ink mb-4">Risk Trend — Analysis Runs</h2>
            {stats?.risk_trend && stats.risk_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.risk_trend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fill: "#8a8470" }} axisLine={{ stroke: "#e9e4d8" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#8a8470" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif", borderRadius: 6, border: "1px solid #e3ded2" }} />
                  <Bar dataKey="critical" fill={RISK_COLORS.critical} name="Critical" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="high" fill={RISK_COLORS.high} name="High" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-muted-faint text-sm">
                Run an analysis to see trend data
              </div>
            )}
          </div>

          <div className="card p-[18px]">
            <h2 className="text-[13px] font-semibold text-ink mb-4">Risk Distribution</h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif" }}>{value}</span>}
                  />
                  <Tooltip formatter={(v) => [v, "Advisors"]} contentStyle={{ fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif", borderRadius: 6, border: "1px solid #e3ded2" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-muted-faint text-sm">
                No risk data available
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-[18px] py-3.5 border-b border-line-soft flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink">Priority Advisors — Critical & High Risk</h2>
            <Link href="/advisors" className="text-xs text-ink-navy hover:underline font-semibold">
              View all advisors →
            </Link>
          </div>
          {stats?.top_risk_advisors && stats.top_risk_advisors.length > 0 ? (
            <div className="divide-y divide-line-faint">
              {stats.top_risk_advisors.map((advisor) => (
                <Link
                  key={advisor.id}
                  href={`/advisors/${advisor.id}`}
                  className="flex items-center gap-3.5 px-[18px] py-3 hover:bg-paper-subtle transition-colors"
                >
                  <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${riskGradeBgClass(advisor.risk_grade)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{advisor.full_name}</p>
                    <p className="text-[11.5px] text-muted-label mt-0.5">{advisor.advisor_ref} · {advisor.firm_name}</p>
                  </div>
                  <RiskBadge grade={advisor.risk_grade} />
                  <p className="text-xs text-muted w-[70px] text-right font-mono">
                    {advisor.risk_score.toFixed(1)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-faint text-sm">
              No high-risk advisors identified — run an analysis to see results
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
