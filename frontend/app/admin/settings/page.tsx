"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/components/ui/toast-provider";
import { ingestionApi } from "@/lib/api";
import { SAMPLE_ADVISOR_INGESTION_DATA } from "@/lib/sample-advisor-data";
import { Shield, Download, Upload, FileJson } from "lucide-react";

const rowClass = "flex items-center justify-between p-3 bg-paper-subtle rounded-md";
const pillClass = "text-[10.5px] bg-line-soft text-muted px-2.5 py-0.5 rounded-full";

function downloadSampleJson() {
  const blob = new Blob([JSON.stringify(SAMPLE_ADVISOR_INGESTION_DATA, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-advisor-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => ingestionApi.uploadJson(file),
    onSuccess: ({ data }) => {
      showToast(data.message, "success");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["advisors"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || "Failed to ingest file — check it's valid JSON matching the sample format", "error");
    },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">System Settings</h1>
          <p className="text-[13px] text-muted mt-1">Administration & system configuration</p>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="card p-[18px]">
            <h2 className="text-[13px] font-semibold text-ink mb-3.5">Scheduled Analysis</h2>
            <div className="space-y-2 text-[12.5px] text-muted-body">
              <div className={rowClass}>
                <span>Automated schedule</span>
                <span className={pillClass}>Disabled (POC)</span>
              </div>
              <div className={rowClass}>
                <span>Schedule time</span>
                <span className="font-semibold font-mono">02:00 UTC</span>
              </div>
              <p className="text-xs text-muted-faint pt-1">Configure via <code className="bg-line-faint px-1 rounded">.env</code> — enable in production</p>
            </div>
          </div>

          <div className="card p-[18px]">
            <h2 className="text-[13px] font-semibold text-ink mb-3.5">Alert Notifications</h2>
            <div className="space-y-2 text-[12.5px] text-muted-body">
              <div className={rowClass}>
                <span>Alert threshold</span>
                <span className="font-semibold">High + Critical</span>
              </div>
              <div className={rowClass}>
                <span>SMTP configured</span>
                <span className={pillClass}>Not set (POC)</span>
              </div>
              <p className="text-xs text-muted-faint pt-1">Configure SMTP credentials in <code className="bg-line-faint px-1 rounded">.env</code></p>
            </div>
          </div>

          <div className="card p-[18px]">
            <h2 className="text-[13px] font-semibold text-ink mb-3.5">AI Engine</h2>
            <div className="space-y-2 text-[12.5px] text-muted-body">
              <div className={rowClass}>
                <span>Local (development)</span>
                <span className="font-semibold text-muted-body">LM Studio <span className="text-xs text-muted-faint font-normal">OpenAI-compatible</span></span>
              </div>
              <div className={rowClass}>
                <span>Production</span>
                <span className="font-semibold text-muted-body">Google Gemini</span>
              </div>
              <div className={rowClass}>
                <span>Agents</span>
                <span className="font-semibold">NRA · EDD · Report</span>
              </div>
            </div>
          </div>

          <div className="card p-[18px]">
            <h2 className="text-[13px] font-semibold text-ink mb-3.5">Data Sources</h2>
            <div className="space-y-[7px] text-sm">
              {[
                { label: "Mortgage Lender Spread", status: "Synthetic data" },
                { label: "Protection Provider Spread", status: "Synthetic data" },
                { label: "File Review Results", status: "Synthetic data" },
                { label: "File Review Deficiencies", status: "Synthetic data" },
                { label: "Enhanced Financial Monitoring", status: "Synthetic data" },
              ].map(({ label, status }) => (
                <div key={label} className="flex items-center justify-between p-2.5 bg-paper-subtle rounded-md">
                  <span className="text-xs text-muted-body">{label}</span>
                  <span className="text-xs text-muted-faint">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-[18px]">
          <div className="flex items-center gap-2 mb-1.5">
            <FileJson className="w-4 h-4 text-ink-navy" />
            <h2 className="text-[13px] font-semibold text-ink">Ingest Advisor Data</h2>
          </div>
          <p className="text-xs text-muted-body mb-3.5">
            Upload a JSON file of advisor records to create or update advisors. Records are matched on{" "}
            <code className="bg-line-faint px-1 rounded">advisor_ref</code> — existing advisors are updated, new ones are created.
            Download the sample below for the expected format.
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={downloadSampleJson}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-line rounded-md text-ink text-[13px] font-semibold hover:bg-paper-subtle transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Sample JSON
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="hidden"
              id="ingestion-file-input"
            />
            <label
              htmlFor="ingestion-file-input"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-line rounded-md text-ink text-[13px] font-semibold hover:bg-paper-subtle transition-colors cursor-pointer"
            >
              {selectedFile ? selectedFile.name : "Choose JSON File…"}
            </label>

            <button
              onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
              disabled={!selectedFile || uploadMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md text-[13px] font-semibold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadMutation.isPending ? "Uploading…" : "Upload & Ingest"}
            </button>
          </div>
        </div>

        <div className="card p-[18px]">
          <div className="flex items-center gap-2 mb-3.5">
            <Shield className="w-4 h-4 text-ink-navy" />
            <h2 className="text-[13px] font-semibold text-ink">Demo Credentials</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { role: "Admin", email: "admin@supervision-brain.local", password: "Admin@1234!" },
              { role: "Compliance Officer", email: "compliance@supervision-brain.local", password: "Comply@1234!" },
              { role: "Supervision Manager", email: "supervisor@supervision-brain.local", password: "Super@1234!" },
            ].map(({ role, email, password }) => (
              <div key={role} className="p-3 bg-paper-subtle rounded-md border border-line-soft">
                <p className="text-[11.5px] font-semibold text-ink mb-1.5">{role}</p>
                <p className="text-[11px] text-muted-body font-mono">{email}</p>
                <p className="text-[11px] text-muted-label font-mono">{password}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
