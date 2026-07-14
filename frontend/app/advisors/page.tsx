"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { advisorsApi, type AdvisorCreate } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useToast } from "@/components/ui/toast-provider";
import { cn, formatDate, riskGradeBgClass } from "@/lib/utils";
import { Search, AlertTriangle, Plus, X, Save, Trash2 } from "lucide-react";
import Link from "next/link";

const GRADES = ["", "critical", "high", "medium", "low"] as const;
const GRADE_LABELS: Record<string, string> = {
  "": "All Grades", critical: "Critical", high: "High", medium: "Medium", low: "Low"
};
const GRADE_TEXT_CLASS: Record<string, string> = {
  critical: "text-risk-critical", high: "text-risk-high", medium: "text-risk-medium", low: "text-risk-low",
};

const inputClass = "w-full border border-line-input rounded-md text-[13px] py-2.5 px-3 outline-none focus:ring-2 focus:ring-ink-navy/20 focus:border-ink-navy bg-white";
const labelClass = "block text-[11px] font-semibold text-muted-strong mb-1.5 uppercase tracking-wide";

type Row = Record<string, string | boolean>;

interface RowFieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "checkbox";
  placeholder?: string;
  step?: string;
}

function emptyRow(fields: RowFieldConfig[]): Row {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : ""]));
}

function RepeatableRows({
  rows, fields, onChange, addLabel,
}: {
  rows: Row[];
  fields: RowFieldConfig[];
  onChange: (rows: Row[]) => void;
  addLabel: string;
}) {
  const updateRow = (idx: number, key: string, value: string | boolean) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const addRow = () => onChange([...rows, emptyRow(fields)]);

  return (
    <div>
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-end gap-2 mb-2.5">
          {fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.key} className="shrink-0 pb-2.5 flex items-center gap-1.5 text-xs text-muted-body cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!row[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.checked)}
                  className="rounded accent-ink-navy"
                />
                {f.label}
              </label>
            ) : (
              <div key={f.key} className="flex-1 min-w-0">
                <label className="block text-[10px] font-semibold text-muted-faint mb-1 uppercase tracking-wide">{f.label}</label>
                <input
                  type={f.type}
                  step={f.step}
                  value={row[f.key] as string}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={cn(inputClass, "py-2", f.type === "number" && "font-mono")}
                />
              </div>
            )
          )}
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="shrink-0 p-2 text-muted-faint hover:text-risk-critical transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-semibold text-ink-navy hover:underline"
      >
        <Plus className="w-3 h-3" /> {addLabel}
      </button>
    </div>
  );
}

const LENDER_FIELDS: RowFieldConfig[] = [
  { key: "lender", label: "Lender", type: "text", placeholder: "e.g. Halifax" },
  { key: "percentage", label: "Percentage", type: "number", placeholder: "40" },
  { key: "case_count", label: "Case Count", type: "number", placeholder: "12" },
];

const PROVIDER_FIELDS: RowFieldConfig[] = [
  { key: "provider", label: "Provider", type: "text", placeholder: "e.g. Aviva" },
  { key: "percentage", label: "Percentage", type: "number", placeholder: "55" },
  { key: "case_count", label: "Case Count", type: "number", placeholder: "9" },
  { key: "avg_commission_rate", label: "Avg Commission", type: "number", placeholder: "0.18", step: "0.01" },
  { key: "is_high_commission", label: "High Commission", type: "checkbox" },
];

const FILE_REVIEW_FIELDS: RowFieldConfig[] = [
  { key: "month", label: "Month", type: "text", placeholder: "Jan 2026" },
  { key: "grade", label: "Grade", type: "text", placeholder: "A" },
  { key: "cases_reviewed", label: "Reviewed", type: "number", placeholder: "9" },
  { key: "passed", label: "Passed", type: "number", placeholder: "8" },
  { key: "failed", label: "Failed", type: "number", placeholder: "1" },
];

const DEFICIENCY_FIELDS: RowFieldConfig[] = [
  { key: "code", label: "Code", type: "text", placeholder: "FR-014" },
  { key: "description", label: "Description", type: "text", placeholder: "Missing suitability rationale" },
  { key: "count", label: "Count", type: "number", placeholder: "1" },
  { key: "lender_related", label: "Related Lender", type: "text", placeholder: "Optional" },
];

type AdvisorFormData = {
  advisor_ref: string;
  full_name: string;
  firm_name: string;
  firm_ref: string;
  status: string;
  enhanced_financial_monitoring: boolean;
  mortgage_lender_spread: Row[];
  protection_provider_spread: Row[];
  file_review_results: Row[];
  file_review_deficiencies: Row[];
};

const EMPTY_ADVISOR_FORM: AdvisorFormData = {
  advisor_ref: "", full_name: "", firm_name: "", firm_ref: "",
  status: "active", enhanced_financial_monitoring: false,
  mortgage_lender_spread: [], protection_provider_spread: [],
  file_review_results: [], file_review_deficiencies: [],
};

function buildAdvisorPayload(form: AdvisorFormData): AdvisorCreate {
  return {
    advisor_ref: form.advisor_ref.trim(),
    full_name: form.full_name.trim(),
    firm_name: form.firm_name.trim(),
    firm_ref: form.firm_ref.trim(),
    status: form.status,
    enhanced_financial_monitoring: form.enhanced_financial_monitoring,
    mortgage_lender_spread: form.mortgage_lender_spread
      .filter((r) => r.lender)
      .map((r) => ({
        lender: r.lender as string,
        percentage: parseFloat(r.percentage as string) || 0,
        case_count: parseInt(r.case_count as string, 10) || 0,
      })),
    protection_provider_spread: form.protection_provider_spread
      .filter((r) => r.provider)
      .map((r) => ({
        provider: r.provider as string,
        percentage: parseFloat(r.percentage as string) || 0,
        case_count: parseInt(r.case_count as string, 10) || 0,
        avg_commission_rate: r.avg_commission_rate ? parseFloat(r.avg_commission_rate as string) : undefined,
        is_high_commission: !!r.is_high_commission,
      })),
    file_review_results: form.file_review_results
      .filter((r) => r.month)
      .map((r) => ({
        month: r.month as string,
        grade: (r.grade as string) || "N/A",
        cases_reviewed: parseInt(r.cases_reviewed as string, 10) || 0,
        passed: parseInt(r.passed as string, 10) || 0,
        failed: parseInt(r.failed as string, 10) || 0,
      })),
    file_review_deficiencies: form.file_review_deficiencies
      .filter((r) => r.code)
      .map((r) => ({
        code: r.code as string,
        description: (r.description as string) || "",
        count: parseInt(r.count as string, 10) || 0,
        lender_related: (r.lender_related as string) || undefined,
      })),
  };
}

export default function AdvisorsPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AdvisorFormData>(EMPTY_ADVISOR_FORM);

  const { data: advisors, isLoading } = useQuery({
    queryKey: ["advisors", { grade, search }],
    queryFn: () => advisorsApi.list({ risk_grade: grade || undefined, search: search || undefined, limit: 200 }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: AdvisorCreate) => advisorsApi.create(data),
    onSuccess: () => {
      showToast("Advisor created", "success");
      qc.invalidateQueries({ queryKey: ["advisors"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowForm(false);
      setForm(EMPTY_ADVISOR_FORM);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || "Failed to create advisor", "error");
    },
  });

  const isValid = form.advisor_ref.trim() && form.full_name.trim() && form.firm_name.trim() && form.firm_ref.trim();

  const counts = {
    critical: advisors?.filter((a) => a.current_risk_grade === "critical").length ?? 0,
    high: advisors?.filter((a) => a.current_risk_grade === "high").length ?? 0,
    medium: advisors?.filter((a) => a.current_risk_grade === "medium").length ?? 0,
    low: advisors?.filter((a) => a.current_risk_grade === "low").length ?? 0,
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Advisor Register</h1>
            <p className="text-[13px] text-muted mt-1">
              {advisors?.length ?? 0} advisors · sorted by risk score
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark text-white rounded-md text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Advisor
          </button>
        </div>

        {showForm && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-ink">New Advisor</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-paper-subtle rounded text-muted-faint">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5 mb-5">
              <div>
                <label className={labelClass}>Advisor Ref</label>
                <input
                  value={form.advisor_ref}
                  onChange={(e) => setForm({ ...form, advisor_ref: e.target.value })}
                  placeholder="e.g. ADV10101"
                  className={cn(inputClass, "font-mono")}
                />
              </div>
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Firm Name</label>
                <input
                  value={form.firm_name}
                  onChange={(e) => setForm({ ...form, firm_name: e.target.value })}
                  placeholder="e.g. Example Wealth Management"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Firm Ref</label>
                <input
                  value={form.firm_ref}
                  onChange={(e) => setForm({ ...form, firm_ref: e.target.value })}
                  placeholder="e.g. FIRM001"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm text-muted-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enhanced_financial_monitoring}
                    onChange={(e) => setForm({ ...form, enhanced_financial_monitoring: e.target.checked })}
                    className="rounded accent-ink-navy"
                  />
                  Enhanced Financial Monitoring
                </label>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-[12px] font-semibold text-ink mb-2.5">Mortgage Lender Spread</h3>
                <RepeatableRows
                  rows={form.mortgage_lender_spread}
                  fields={LENDER_FIELDS}
                  addLabel="Add Lender"
                  onChange={(rows) => setForm({ ...form, mortgage_lender_spread: rows })}
                />
              </div>

              <div>
                <h3 className="text-[12px] font-semibold text-ink mb-2.5">Protection Provider Spread</h3>
                <RepeatableRows
                  rows={form.protection_provider_spread}
                  fields={PROVIDER_FIELDS}
                  addLabel="Add Provider"
                  onChange={(rows) => setForm({ ...form, protection_provider_spread: rows })}
                />
              </div>

              <div>
                <h3 className="text-[12px] font-semibold text-ink mb-2.5">File Review Results</h3>
                <RepeatableRows
                  rows={form.file_review_results}
                  fields={FILE_REVIEW_FIELDS}
                  addLabel="Add Month"
                  onChange={(rows) => setForm({ ...form, file_review_results: rows })}
                />
              </div>

              <div>
                <h3 className="text-[12px] font-semibold text-ink mb-2.5">File Review Deficiencies</h3>
                <RepeatableRows
                  rows={form.file_review_deficiencies}
                  fields={DEFICIENCY_FIELDS}
                  addLabel="Add Deficiency"
                  onChange={(rows) => setForm({ ...form, file_review_deficiencies: rows })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-5 pt-4 border-t border-line-soft">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-[13px] font-medium text-muted hover:bg-paper-subtle rounded-md transition-colors">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(buildAdvisorPayload(form))}
                disabled={!isValid || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md text-[13px] font-semibold transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {createMutation.isPending ? "Creating…" : "Create Advisor"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          {(["critical", "high", "medium", "low"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGrade(grade === g ? "" : g)}
              className={cn(
                "text-left bg-white border rounded-card p-3.5 transition-colors font-sans",
                grade === g ? "border-ink-navy" : "border-line"
              )}
            >
              <p className="text-[10.5px] text-muted-label uppercase tracking-wider">{GRADE_LABELS[g]}</p>
              <p className={cn("text-2xl font-bold font-mono mt-1.5 mb-1.5", GRADE_TEXT_CLASS[g])}>{counts[g]}</p>
              <RiskBadge grade={g} />
            </button>
          ))}
        </div>

        <div className="card">
          <div className="p-4 border-b border-line-soft flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, firm, or advisor ref…"
                className="w-full pl-8 pr-4 py-2.5 border border-line-input rounded-md text-[13px] outline-none focus:ring-2 focus:ring-ink-navy/20 focus:border-ink-navy"
              />
            </div>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="border border-line-input rounded-md text-[13px] py-2.5 px-2.5 bg-white outline-none focus:ring-2 focus:ring-ink-navy/20"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>{GRADE_LABELS[g]}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-faint text-sm">Loading advisors…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-paper-subtle border-b border-line-soft">
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-muted-label uppercase tracking-wide">Advisor</th>
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-muted-label uppercase tracking-wide">Firm</th>
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-muted-label uppercase tracking-wide">Risk Grade</th>
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-muted-label uppercase tracking-wide">Score</th>
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-muted-label uppercase tracking-wide">EFM</th>
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-muted-label uppercase tracking-wide">Last Analysed</th>
                  </tr>
                </thead>
                <tbody>
                  {advisors?.map((advisor) => (
                    <tr key={advisor.id}>
                      <td className="px-0 py-0" colSpan={6}>
                        <Link
                          href={`/advisors/${advisor.id}`}
                          className="grid grid-cols-[2fr_2fr_1.2fr_1.2fr_0.8fr_1fr] items-center border-b border-line-faint hover:bg-paper-subtle transition-colors"
                        >
                          <div className="px-4 py-[11px]">
                            <p className="font-semibold text-ink">{advisor.full_name}</p>
                            <p className="text-[11.5px] text-muted-label font-mono mt-0.5">{advisor.advisor_ref}</p>
                          </div>
                          <div className="px-4 py-[11px] text-muted-body">{advisor.firm_name}</div>
                          <div className="px-4 py-[11px]"><RiskBadge grade={advisor.current_risk_grade} /></div>
                          <div className="px-4 py-[11px]">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-[5px] bg-line-soft rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full", riskGradeBgClass(advisor.current_risk_grade))}
                                  style={{ width: `${(advisor.current_risk_score / 10) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11.5px] text-muted font-mono">{advisor.current_risk_score.toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="px-4 py-[11px]">
                            {advisor.enhanced_financial_monitoring ? (
                              <span className="flex items-center gap-1 text-risk-critical text-[11.5px] font-semibold">
                                <AlertTriangle className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="text-[11.5px] text-muted-faint">Clear</span>
                            )}
                          </div>
                          <div className="px-4 py-[11px] text-[11.5px] text-muted-label font-mono">{formatDate(advisor.last_analysed_at)}</div>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {advisors?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-faint text-sm">
                        No advisors found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
