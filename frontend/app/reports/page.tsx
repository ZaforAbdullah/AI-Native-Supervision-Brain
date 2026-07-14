"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { reportsApi, type Report } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/components/ui/toast-provider";
import { downloadBlob, formatDateTime } from "@/lib/utils";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  const { showToast } = useToast();
  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsApi.list().then((r) => r.data),
  });

  const downloadMutation = useMutation({
    mutationFn: async ({ report, type }: { report: Report; type: "pdf" | "excel" }) => {
      const res = type === "pdf" ? await reportsApi.downloadPdf(report.id) : await reportsApi.downloadExcel(report.id);
      downloadBlob(res.data, `${report.report_ref}.${type === "pdf" ? "pdf" : "xlsx"}`);
    },
    onError: () => showToast("Failed to download report", "error"),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Supervision Reports</h1>
          <p className="text-[13px] text-muted mt-1">
            Generated Network Risk Analysis reports · PDF & Excel download
          </p>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="p-8 text-center text-muted-faint text-sm">Loading reports…</div>
          ) : reports && reports.length > 0 ? (
            <div className="divide-y divide-line-faint">
              {reports.map((report) => (
                <div key={report.id} className="p-[18px] flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="font-semibold text-[14px] text-ink">{report.title}</p>
                      <span className="text-[10.5px] font-mono bg-line-faint text-muted px-2 py-0.5 rounded">
                        {report.report_ref}
                      </span>
                    </div>
                    {report.summary && (
                      <p className="text-xs text-muted-body leading-relaxed mb-2.5">{report.summary}</p>
                    )}
                    <div className="flex items-center gap-[18px] text-[11.5px] text-muted-label">
                      <span>Advisors: <b className="text-muted-body font-mono">{report.total_advisors}</b></span>
                      <span className="text-risk-critical">Critical: <b className="font-mono">{report.critical_risk_count}</b></span>
                      <span className="text-risk-high">High: <b className="font-mono">{report.high_risk_count}</b></span>
                      <span>Generated: {formatDateTime(report.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {report.pdf_path && (
                      <button
                        onClick={() => downloadMutation.mutate({ report, type: "pdf" })}
                        disabled={downloadMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-[7px] bg-risk-critical-bg hover:opacity-80 disabled:opacity-50 text-risk-critical border border-risk-critical-border rounded-md text-[11.5px] font-semibold transition-opacity"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    )}
                    {report.excel_path && (
                      <button
                        onClick={() => downloadMutation.mutate({ report, type: "excel" })}
                        disabled={downloadMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-[7px] bg-risk-low-bg hover:opacity-80 disabled:opacity-50 text-risk-low border border-risk-low-border rounded-md text-[11.5px] font-semibold transition-opacity"
                      >
                        <Download className="w-3 h-3" /> Excel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-line mx-auto mb-3" />
              <p className="text-muted font-semibold">No reports yet</p>
              <p className="text-sm text-muted-faint mt-1">Run an analysis from the Dashboard to generate reports</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
