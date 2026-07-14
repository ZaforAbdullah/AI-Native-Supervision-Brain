"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { advisorsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useToast } from "@/components/ui/toast-provider";
import { formatDateTime } from "@/lib/utils";
import { use } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function AdvisorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showToast } = useToast();
  const qc = useQueryClient();
  const { data: advisor, isLoading } = useQuery({
    queryKey: ["advisor", id],
    queryFn: () => advisorsApi.get(Number(id)).then((r) => r.data),
  });
  const { data: findings } = useQuery({
    queryKey: ["advisor-findings", id],
    queryFn: () => advisorsApi.findings(Number(id)).then((r) => r.data),
  });

  const discoverMutation = useMutation({
    mutationFn: () => advisorsApi.discoverPatterns(Number(id)),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["advisor-findings", id] });
      showToast(
        data.length > 0 ? `AI surfaced ${data.length} pattern(s) for review` : "No new patterns found",
        data.length > 0 ? "success" : "info"
      );
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || "Failed to discover patterns", "error");
    },
  });

  if (isLoading) {
    return <AppLayout><div className="p-8 text-center text-muted-faint">Loading advisor…</div></AppLayout>;
  }
  if (!advisor) {
    return <AppLayout><div className="p-8 text-center text-muted-faint">Advisor not found</div></AppLayout>;
  }

  const ruleFindings = findings?.filter((f) => f.source !== "ai") ?? [];
  const aiFindings = findings?.filter((f) => f.source === "ai") ?? [];

  const fileReviewBarData = advisor.file_review_results?.map((r) => ({
    month: r.month,
    passed: r.passed,
    failed: r.failed,
  })) ?? [];

  return (
    <AppLayout>
      <div className="space-y-3.5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/advisors" className="w-[30px] h-[30px] rounded-md border border-line bg-white flex items-center justify-center hover:bg-paper-subtle transition-colors shrink-0">
            <ArrowLeft className="w-3.5 h-3.5 text-muted-body" />
          </Link>
          <div className="flex-1">
            <h1 className="text-[19px] font-bold text-ink">{advisor.full_name}</h1>
            <p className="text-[12.5px] text-muted mt-0.5">{advisor.advisor_ref} · {advisor.firm_name}</p>
          </div>
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-line rounded-md text-ink text-[13px] font-semibold hover:bg-paper-subtle disabled:opacity-60 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-ink-navy" />
            {discoverMutation.isPending ? "Discovering…" : "Discover AI Patterns"}
          </button>
          <RiskBadge grade={advisor.current_risk_grade} className="text-[12.5px] px-3.5 py-1.5" />
        </div>

        <div className="grid grid-cols-4 gap-3.5">
          <div className="card px-4 py-3.5">
            <p className="text-[11px] text-muted-label mb-1.5">Advisor Ref</p>
            <p className="text-[13.5px] font-semibold text-ink font-mono">{advisor.advisor_ref}</p>
          </div>
          <div className="card px-4 py-3.5">
            <p className="text-[11px] text-muted-label mb-1.5">Firm</p>
            <p className="text-[13.5px] font-semibold text-ink">{advisor.firm_name}</p>
          </div>
          <div className="card px-4 py-3.5">
            <p className="text-[11px] text-muted-label mb-1.5">Risk Score</p>
            <p className="text-[13.5px] font-semibold text-ink font-mono">{advisor.current_risk_score.toFixed(1)} / 10</p>
          </div>
          <div className="card px-4 py-3.5">
            <p className="text-[11px] text-muted-label mb-1.5">EFM Flag</p>
            <p className={`text-[13.5px] font-semibold ${advisor.enhanced_financial_monitoring ? "text-risk-critical" : "text-ink"}`}>
              {advisor.enhanced_financial_monitoring ? "ACTIVE" : "Clear"}
            </p>
          </div>
        </div>

        {ruleFindings.length > 0 && (
          <div className="card">
            <div className="px-[18px] py-3.5 border-b border-line-soft">
              <h2 className="text-[13px] font-semibold text-ink">Risk Findings ({ruleFindings.length})</h2>
            </div>
            <div className="divide-y divide-line-faint">
              {ruleFindings.map((f) => (
                <div key={f.id} className="px-[18px] py-4">
                  <div className="flex items-center justify-between gap-2.5 mb-2">
                    <div className="flex items-center gap-2.5">
                      <RiskBadge grade={f.risk_grade} />
                      <p className="text-[13px] font-semibold text-ink">{f.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {f.requires_edd && (
                        <span className="text-[10.5px] bg-accent-purple-bg text-accent-purple border border-accent-purple-border px-2.5 py-0.5 rounded-full font-semibold">
                          EDD Required
                        </span>
                      )}
                      {f.edd_completed && (
                        <span className="text-[10.5px] bg-risk-low-bg text-risk-low border border-risk-low-border px-2.5 py-0.5 rounded-full font-semibold">
                          EDD Complete
                        </span>
                      )}
                    </div>
                  </div>
                  {f.description && <p className="text-xs text-muted-body mb-2 leading-relaxed">{f.description}</p>}
                  {f.triggered_value != null && f.threshold_value != null && (
                    <div className="flex gap-4 text-[11.5px] text-muted-label mb-2.5">
                      <span>Triggered at: <b className="text-muted-body font-mono">{f.triggered_value.toFixed(1)}%</b></span>
                      <span>Threshold: <b className="text-muted-body font-mono">{f.threshold_value.toFixed(1)}%</b></span>
                    </div>
                  )}
                  {f.ai_analysis && (
                    <div className="mt-2 p-[11px] px-[13px] bg-accent-info-bg border border-accent-info-border rounded-md">
                      <p className="text-[11px] font-semibold text-ink-navy mb-1">AI Analysis</p>
                      <p className="text-xs text-[#3d4a56] leading-relaxed">{f.ai_analysis}</p>
                    </div>
                  )}
                  {f.edd_notes && (
                    <div className="mt-2 p-[11px] px-[13px] bg-accent-purple-bg border border-accent-purple-border rounded-md">
                      <p className="text-[11px] font-semibold text-accent-purple mb-1">EDD Notes</p>
                      <pre className="text-xs text-muted-body whitespace-pre-wrap font-sans leading-relaxed">
                        {f.edd_notes}
                      </pre>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-faint mt-2.5">{formatDateTime(f.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {aiFindings.length > 0 && (
          <div className="card">
            <div className="px-[18px] py-3.5 border-b border-line-soft flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-ink-navy" />
              <h2 className="text-[13px] font-semibold text-ink">AI-Discovered Patterns ({aiFindings.length})</h2>
            </div>
            <div className="divide-y divide-line-faint">
              {aiFindings.map((f) => (
                <div key={f.id} className="px-[18px] py-4">
                  <div className="flex items-center justify-between gap-2.5 mb-2">
                    <div className="flex items-center gap-2.5">
                      <RiskBadge grade={f.risk_grade} />
                      <p className="text-[13px] font-semibold text-ink">{f.title}</p>
                    </div>
                    <span className="text-[10.5px] bg-accent-info-bg text-ink-navy border border-accent-info-border px-2.5 py-0.5 rounded-full font-semibold shrink-0">
                      AI-Suggested — Not Verified
                    </span>
                  </div>
                  {f.description && <p className="text-xs text-muted-body mb-2 leading-relaxed">{f.description}</p>}
                  {(f.evidence as { rationale?: string } | null)?.rationale && (
                    <div className="mt-2 p-[11px] px-[13px] bg-accent-info-bg border border-accent-info-border rounded-md">
                      <p className="text-[11px] font-semibold text-ink-navy mb-1">Rationale</p>
                      <p className="text-xs text-[#3d4a56] leading-relaxed">
                        {(f.evidence as { rationale?: string }).rationale}
                      </p>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-faint mt-2.5">{formatDateTime(f.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          {advisor.mortgage_lender_spread && advisor.mortgage_lender_spread.length > 0 && (
            <div className="card p-[18px]">
              <h2 className="text-[13px] font-semibold text-ink mb-3.5">Mortgage Lender Spread</h2>
              {advisor.mortgage_lender_spread.map((l) => (
                <div key={l.lender} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between text-xs text-muted-body mb-1">
                    <span>{l.lender}</span>
                    <span className="font-mono">{l.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-line-faint rounded-full overflow-hidden">
                    <div className="h-full bg-ink-navy rounded-full" style={{ width: `${l.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {advisor.protection_provider_spread && advisor.protection_provider_spread.length > 0 && (
            <div className="card p-[18px]">
              <h2 className="text-[13px] font-semibold text-ink mb-3.5">Protection Provider Spread</h2>
              {advisor.protection_provider_spread.map((p) => (
                <div key={p.provider} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between text-xs text-muted-body mb-1">
                    <span>{p.provider}</span>
                    <span className="font-mono">{p.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-line-faint rounded-full overflow-hidden">
                    <div className="h-full bg-risk-low rounded-full" style={{ width: `${p.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {fileReviewBarData.length > 0 && (
          <div className="card p-[18px]">
            <h2 className="text-[13px] font-semibold text-ink mb-4">File Review History (12 Months)</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={fileReviewBarData}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fill: "#8a8470" }} axisLine={{ stroke: "#e9e4d8" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8a8470" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif", borderRadius: 6, border: "1px solid #e3ded2" }} />
                <Bar dataKey="passed" fill="#5c8368" name="Passed" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="failed" fill="#8c2b1f" name="Failed" radius={[2, 2, 0, 0]} stackId="a" />
                <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif" }}>{v}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {advisor.file_review_deficiencies && advisor.file_review_deficiencies.length > 0 && (
          <div className="card">
            <div className="px-[18px] py-3.5 border-b border-line-soft">
              <h2 className="text-[13px] font-semibold text-ink">File Review Deficiencies</h2>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-paper-subtle border-b border-line-soft">
                  <th className="text-left px-4 py-[9px] text-[10.5px] font-semibold text-muted-label uppercase">Code</th>
                  <th className="text-left px-4 py-[9px] text-[10.5px] font-semibold text-muted-label uppercase">Description</th>
                  <th className="text-left px-4 py-[9px] text-[10.5px] font-semibold text-muted-label uppercase">Count</th>
                  <th className="text-left px-4 py-[9px] text-[10.5px] font-semibold text-muted-label uppercase">Related Lender</th>
                </tr>
              </thead>
              <tbody>
                {advisor.file_review_deficiencies.map((d) => (
                  <tr key={d.code} className="border-b border-line-faint last:border-0">
                    <td className="px-4 py-2.5 font-mono font-semibold text-muted-body">{d.code}</td>
                    <td className="px-4 py-2.5 text-muted-body">{d.description}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{d.count}</td>
                    <td className="px-4 py-2.5 text-muted-label">{d.lender_related || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
