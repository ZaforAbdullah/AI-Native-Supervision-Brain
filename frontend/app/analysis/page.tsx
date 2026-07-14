"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analysisApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";
import { Play, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: "text-risk-low", bg: "bg-risk-low-bg", label: "Completed" },
  failed: { icon: XCircle, color: "text-risk-critical", bg: "bg-risk-critical-bg", label: "Failed" },
  running: { icon: RefreshCw, color: "text-ink-navy", bg: "bg-accent-info-bg", label: "Running" },
  pending: { icon: Clock, color: "text-muted", bg: "bg-paper-subtle", label: "Pending" },
};

export default function AnalysisPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();

  const { data: runs, isLoading } = useQuery({
    queryKey: ["analysis-runs"],
    queryFn: () => analysisApi.list().then((r) => r.data),
    refetchInterval: 10_000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => analysisApi.trigger({ trigger: "manual" }),
    onSuccess: () => {
      showToast("Analysis triggered successfully", "success");
      qc.invalidateQueries({ queryKey: ["analysis-runs"] });
    },
    onError: () => showToast("Failed to trigger analysis", "error"),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Analysis Runs</h1>
            <p className="text-[13px] text-muted mt-1">Network Risk Analysis execution history</p>
          </div>
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
            Trigger New Analysis
          </button>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="p-8 text-center text-muted-faint text-sm">Loading runs…</div>
          ) : runs && runs.length > 0 ? (
            <div className="divide-y divide-line-faint">
              {runs.map((run) => {
                const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <div key={run.id} className="px-[18px] py-3.5">
                    <div className="flex items-start gap-3.5">
                      <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", cfg.bg)}>
                        <Icon className={cn("w-[15px] h-[15px]", cfg.color, run.status === "running" && "animate-spin")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-[13px] font-semibold text-ink">{run.run_ref}</p>
                          <span className={cn("text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
                          <span className="text-[10.5px] text-muted-faint bg-line-faint px-2.5 py-0.5 rounded-full">
                            {run.trigger}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-[5px] text-[11.5px] text-muted-label">
                          <span>Started: {formatDateTime(run.started_at)}</span>
                          {run.completed_at && (
                            <span>Completed: {formatDateTime(run.completed_at)}</span>
                          )}
                        </div>
                        {run.status === "completed" && (
                          <div className="flex items-center gap-[18px] mt-2 text-[11.5px]">
                            <span className="text-muted-body">Advisors: <b className="font-mono">{run.advisors_analysed}</b></span>
                            <span className="text-muted-body">Findings: <b className="font-mono">{run.risks_identified}</b></span>
                            {run.critical_risk_count > 0 && (
                              <span className="flex items-center gap-1 text-risk-critical font-semibold">
                                <AlertTriangle className="w-3 h-3" /> {run.critical_risk_count} Critical
                              </span>
                            )}
                            {run.high_risk_count > 0 && (
                              <span className="flex items-center gap-1 text-risk-high font-semibold">
                                <AlertTriangle className="w-3 h-3" /> {run.high_risk_count} High
                              </span>
                            )}
                          </div>
                        )}
                        {run.error_message && (
                          <p className="mt-[7px] text-[11.5px] text-risk-critical bg-risk-critical-bg px-2.5 py-1 rounded-md inline-block">
                            Error: {run.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Play className="w-10 h-10 text-line mx-auto mb-3" />
              <p className="text-muted font-semibold">No analysis runs yet</p>
              <p className="text-sm text-muted-faint mt-1">Trigger an analysis to get started</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
