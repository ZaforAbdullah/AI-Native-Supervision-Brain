"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rulesApi, type RiskRule } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { RiskBadge } from "@/components/ui/risk-badge";
import { DATASET_LABELS } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CONDITION_LABELS: Record<string, string> = {
  max_concentration_gt: "Max concentration >",
  poor_review_rate_gt: "Poor review rate >",
  deficiency_with_concentration: "Deficiency + concentration combo",
  efm_with_high_commission: "EFM flag + high commission",
};

type RuleFormData = {
  name: string;
  description: string;
  dataset: string;
  condition_type: string;
  threshold_value: number;
  risk_grade: string;
  risk_weight: number;
  requires_edd: boolean;
  is_active: boolean;
  ai_prompt_hint: string;
};

const EMPTY_FORM: RuleFormData = {
  name: "", description: "", dataset: "mortgage_lender_spread",
  condition_type: "max_concentration_gt", threshold_value: 50,
  risk_grade: "medium", risk_weight: 1.0, requires_edd: false,
  is_active: true, ai_prompt_hint: "",
};

const inputClass = "w-full border border-line-input rounded-md text-[13px] py-2.5 px-3 outline-none focus:ring-2 focus:ring-ink-navy/20 focus:border-ink-navy bg-white";
const labelClass = "block text-[11px] font-semibold text-muted-strong mb-1.5 uppercase tracking-wide";

export default function RulesPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<RiskRule | null>(null);
  const [form, setForm] = useState<RuleFormData>(EMPTY_FORM);
  const [nlDescription, setNlDescription] = useState("");

  const { data: rules, isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: () => rulesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: RuleFormData) => rulesApi.create(data as Parameters<typeof rulesApi.create>[0]),
    onSuccess: () => { showToast("Rule created", "success"); qc.invalidateQueries({ queryKey: ["rules"] }); setShowForm(false); setForm(EMPTY_FORM); },
    onError: () => showToast("Failed to create rule", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RuleFormData> }) => rulesApi.update(id, data as Parameters<typeof rulesApi.update>[1]),
    onSuccess: () => { showToast("Rule updated", "success"); qc.invalidateQueries({ queryKey: ["rules"] }); setEditRule(null); setShowForm(false); },
    onError: () => showToast("Failed to update rule", "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => rulesApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rulesApi.delete(id),
    onSuccess: () => { showToast("Rule deleted", "info"); qc.invalidateQueries({ queryKey: ["rules"] }); },
    onError: () => showToast("Failed to delete rule", "error"),
  });

  const draftMutation = useMutation({
    mutationFn: (description: string) => rulesApi.draft(description),
    onSuccess: ({ data }) => {
      setForm({
        name: data.name,
        description: data.description || "",
        dataset: data.dataset,
        condition_type: data.condition_type,
        threshold_value: data.threshold_value,
        risk_grade: data.risk_grade,
        risk_weight: data.risk_weight,
        requires_edd: data.requires_edd,
        is_active: data.is_active,
        ai_prompt_hint: data.ai_prompt_hint || "",
      });
      showToast("Draft ready — review before saving", "info");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || "Could not draft rule from description", "error");
    },
  });

  const openCreate = () => { setEditRule(null); setForm(EMPTY_FORM); setNlDescription(""); setShowForm(true); };
  const openEdit = (rule: RiskRule) => {
    setEditRule(rule);
    setForm({
      name: rule.name, description: rule.description || "",
      dataset: rule.dataset, condition_type: rule.condition_type,
      threshold_value: rule.threshold_value, risk_grade: rule.risk_grade,
      risk_weight: rule.risk_weight, requires_edd: rule.requires_edd,
      is_active: rule.is_active, ai_prompt_hint: rule.ai_prompt_hint || "",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editRule) {
      updateMutation.mutate({ id: editRule.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Risk Rules Configuration</h1>
            <p className="text-[13px] text-muted mt-1">Configure NRA rules, thresholds, and AI prompts</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark text-white rounded-md text-[13px] font-semibold transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>

        {showForm && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-ink">{editRule ? "Edit Rule" : "New Rule"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-paper-subtle rounded text-muted-faint">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!editRule && (
              <div className="mb-5 p-3.5 bg-accent-info-bg border border-accent-info-border rounded-md">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-navy mb-1.5 uppercase tracking-wide">
                  <Sparkles className="w-3.5 h-3.5" /> Describe in Plain English
                </label>
                <div className="flex gap-2.5">
                  <input
                    value={nlDescription}
                    onChange={(e) => setNlDescription(e.target.value)}
                    placeholder="e.g. Flag advisors who place more than 60% of mortgage cases with a single lender"
                    className={cn(inputClass, "flex-1 bg-white")}
                  />
                  <button
                    onClick={() => nlDescription.trim() && draftMutation.mutate(nlDescription)}
                    disabled={!nlDescription.trim() || draftMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md text-[13px] font-semibold transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {draftMutation.isPending ? "Drafting…" : "Draft with AI"}
                  </button>
                </div>
                <p className="text-[11px] text-ink-navy/70 mt-2">
                  Fills in the fields below for you to review — nothing is saved until you click Create Rule.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3.5">
              {[
                { label: "Rule Name", field: "name", type: "text", placeholder: "e.g. Lender Concentration High" },
                { label: "Dataset", field: "dataset", type: "select", options: Object.entries(DATASET_LABELS).map(([v, l]) => ({ value: v, label: l })) },
                { label: "Condition Type", field: "condition_type", type: "select", options: Object.entries(CONDITION_LABELS).map(([v, l]) => ({ value: v, label: l })) },
                { label: "Threshold Value", field: "threshold_value", type: "number", placeholder: "50" },
                { label: "Risk Grade", field: "risk_grade", type: "select", options: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" }] },
                { label: "Risk Weight", field: "risk_weight", type: "number", placeholder: "1.0" },
              ].map(({ label, field, type, placeholder, options }) => (
                <div key={field}>
                  <label className={labelClass}>{label}</label>
                  {type === "select" ? (
                    <select
                      value={form[field as keyof RuleFormData] as string}
                      onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                      className={inputClass}
                    >
                      {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={type}
                      value={form[field as keyof RuleFormData] as string | number}
                      onChange={(e) => setForm({ ...form, [field]: type === "number" ? parseFloat(e.target.value) : e.target.value })}
                      placeholder={placeholder}
                      className={cn(inputClass, type === "number" && "font-mono")}
                    />
                  )}
                </div>
              ))}

              <div className="col-span-2">
                <label className={labelClass}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Rule description…"
                />
              </div>

              <div className="col-span-2">
                <label className={labelClass}>AI Prompt Hint</label>
                <textarea
                  value={form.ai_prompt_hint}
                  onChange={(e) => setForm({ ...form, ai_prompt_hint: e.target.value })}
                  rows={2}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Hint for the AI agent when analysing this rule's findings…"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-body cursor-pointer">
                  <input type="checkbox" checked={form.requires_edd} onChange={(e) => setForm({ ...form, requires_edd: e.target.checked })} className="rounded accent-ink-navy" />
                  Requires EDD
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-body cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded accent-ink-navy" />
                  Active
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-4 pt-4 border-t border-line-soft">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-[13px] font-medium text-muted hover:bg-paper-subtle rounded-md transition-colors">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark text-white rounded-md text-[13px] font-semibold transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {editRule ? "Update Rule" : "Create Rule"}
              </button>
            </div>
          </div>
        )}

        <div className="card divide-y divide-line-faint">
          {isLoading ? (
            <div className="p-8 text-center text-muted-faint text-sm">Loading rules…</div>
          ) : rules?.map((rule) => (
            <div key={rule.id} className={cn("px-[18px] py-4 transition-colors", !rule.is_active && "opacity-55 bg-paper-subtle")}>
              <div className="flex items-start justify-between gap-3.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-[5px]">
                    <p className="font-semibold text-ink text-[13.5px]">{rule.name}</p>
                    <RiskBadge grade={rule.risk_grade} />
                    {rule.requires_edd && (
                      <span className="text-[10.5px] bg-accent-purple-bg text-accent-purple border border-accent-purple-border px-2.5 py-0.5 rounded-full font-semibold">EDD</span>
                    )}
                    {!rule.is_active && (
                      <span className="text-[10.5px] bg-line-faint text-muted-faint px-2.5 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mb-2">{rule.description}</p>
                  <div className="flex items-center gap-4 text-[11px] text-muted-faint">
                    <span>Dataset: <b className="text-muted-body">{DATASET_LABELS[rule.dataset] || rule.dataset}</b></span>
                    <span>Condition: <b className="text-muted-body">{CONDITION_LABELS[rule.condition_type] || rule.condition_type} {rule.threshold_value}{rule.threshold_unit === "percent" ? "%" : ""}</b></span>
                    <span>Weight: <b className="text-muted-body">×{rule.risk_weight}</b></span>
                  </div>
                  {rule.ai_prompt_hint && (
                    <p className="text-xs text-ink-navy mt-1.5 italic">AI hint: {rule.ai_prompt_hint}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleMutation.mutate(rule.id)} className="p-1.5 hover:bg-paper-subtle rounded-lg text-muted-faint" title="Toggle active">
                    {rule.is_active ? <ToggleRight className="w-4 h-4 text-risk-low" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(rule)} className="p-1.5 hover:bg-paper-subtle rounded-lg text-muted-faint">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this rule?")) deleteMutation.mutate(rule.id); }}
                    className="p-1.5 hover:bg-risk-critical-bg rounded-lg text-muted-faint hover:text-risk-critical"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
