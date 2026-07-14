import axios from "axios";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("token") || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      Cookies.remove("token");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export type RiskGrade = "low" | "medium" | "high" | "critical";

export interface DashboardStats {
  total_advisors: number;
  active_advisors: number;
  critical_risk_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  last_analysis_run: string | null;
  total_reports: number;
  risk_trend: Array<{ date: string; high: number; critical: number; total: number }>;
  top_risk_advisors: Array<{
    id: number; advisor_ref: string; full_name: string;
    firm_name: string; risk_grade: RiskGrade; risk_score: number;
  }>;
  lender_concentration_alerts: number;
  provider_concentration_alerts: number;
  efm_flags_active: number;
}

export interface Advisor {
  id: number;
  advisor_ref: string;
  full_name: string;
  firm_name: string;
  firm_ref: string;
  status: string;
  current_risk_grade: RiskGrade;
  current_risk_score: number;
  last_analysed_at: string | null;
  enhanced_financial_monitoring: boolean;
  created_at: string;
}

export interface AdvisorDetail extends Advisor {
  mortgage_lender_spread: Array<{ lender: string; percentage: number; case_count: number }> | null;
  protection_provider_spread: Array<{
    provider: string; percentage: number; case_count: number;
    avg_commission_rate: number; is_high_commission: boolean;
  }> | null;
  file_review_results: Array<{
    month: string; grade: string; cases_reviewed: number; passed: number; failed: number;
  }> | null;
  file_review_deficiencies: Array<{
    code: string; description: string; count: number; lender_related: string | null;
  }> | null;
  findings?: Finding[];
}

export interface Finding {
  id: number;
  analysis_run_id: number;
  advisor_id: number;
  finding_type: string;
  risk_grade: RiskGrade;
  risk_score: number;
  title: string;
  description: string | null;
  evidence: Record<string, unknown> | null;
  triggered_value: number | null;
  threshold_value: number | null;
  requires_edd: boolean;
  edd_completed: boolean;
  edd_notes: string | null;
  ai_analysis: string | null;
  source: "rule" | "ai";
  created_at: string;
}

export interface RiskRule {
  id: number;
  name: string;
  description: string | null;
  dataset: string;
  condition_type: string;
  threshold_value: number;
  threshold_unit: string;
  risk_grade: RiskGrade;
  risk_weight: number;
  is_active: boolean;
  requires_edd: boolean;
  ai_prompt_hint: string | null;
  created_at: string;
}

export interface AnalysisRun {
  id: number;
  run_ref: string;
  status: "pending" | "running" | "completed" | "failed";
  trigger: string;
  started_at: string | null;
  completed_at: string | null;
  advisors_analysed: number;
  risks_identified: number;
  high_risk_count: number;
  critical_risk_count: number;
  error_message: string | null;
  created_at: string;
}

export interface Report {
  id: number;
  report_ref: string;
  analysis_run_id: number;
  report_type: string;
  title: string;
  summary: string | null;
  total_advisors: number;
  high_risk_count: number;
  critical_risk_count: number;
  pdf_path: string | null;
  excel_path: string | null;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_active: boolean;
  receive_alerts: boolean;
  created_at: string;
}

export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post<{ access_token: string; token_type: string; user: User }>(
      "/api/auth/token",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
  },
  me: () => api.get<User>("/api/auth/me"),
};

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/api/dashboard/stats"),
};

export interface AdvisorCreate {
  advisor_ref: string;
  full_name: string;
  firm_name: string;
  firm_ref: string;
  status?: string;
  enhanced_financial_monitoring?: boolean;
  mortgage_lender_spread?: Array<{ lender: string; percentage: number; case_count: number }>;
  protection_provider_spread?: Array<{
    provider: string; percentage: number; case_count: number;
    avg_commission_rate?: number; is_high_commission?: boolean;
  }>;
  file_review_results?: Array<{
    month: string; grade: string; cases_reviewed: number; passed: number; failed: number;
  }>;
  file_review_deficiencies?: Array<{
    code: string; description: string; count: number; lender_related?: string;
  }>;
}

export const advisorsApi = {
  list: (params?: { risk_grade?: string; search?: string; limit?: number }) =>
    api.get<Advisor[]>("/api/advisors/", { params }),
  get: (id: number) => api.get<AdvisorDetail>(`/api/advisors/${id}`),
  findings: (id: number) => api.get<Finding[]>(`/api/advisors/${id}/findings`),
  create: (data: AdvisorCreate) => api.post<Advisor>("/api/advisors/", data),
  discoverPatterns: (id: number) => api.post<Finding[]>(`/api/advisors/${id}/discover-patterns`),
};

export interface RuleDraft {
  name: string;
  description: string | null;
  dataset: string;
  condition_type: string;
  threshold_value: number;
  threshold_unit: string;
  risk_grade: RiskGrade;
  risk_weight: number;
  is_active: boolean;
  requires_edd: boolean;
  ai_prompt_hint: string | null;
}

export const rulesApi = {
  list: () => api.get<RiskRule[]>("/api/rules/"),
  create: (data: Partial<RiskRule>) => api.post<RiskRule>("/api/rules/", data),
  update: (id: number, data: Partial<RiskRule>) => api.put<RiskRule>(`/api/rules/${id}`, data),
  toggle: (id: number) => api.patch(`/api/rules/${id}/toggle`),
  delete: (id: number) => api.delete(`/api/rules/${id}`),
  draft: (description: string) => api.post<RuleDraft>("/api/rules/draft", { description }),
};

export const analysisApi = {
  trigger: (data?: { advisor_ids?: number[]; trigger?: string }) =>
    api.post<AnalysisRun>("/api/analysis/trigger", data || {}),
  list: () => api.get<AnalysisRun[]>("/api/analysis/"),
  get: (id: number) => api.get<AnalysisRun>(`/api/analysis/${id}`),
};

export const reportsApi = {
  list: () => api.get<Report[]>("/api/reports/"),
  get: (id: number) => api.get<Report>(`/api/reports/${id}`),
  downloadPdf: (id: number) => api.get(`/api/reports/${id}/download/pdf`, { responseType: "blob" }),
  downloadExcel: (id: number) => api.get(`/api/reports/${id}/download/excel`, { responseType: "blob" }),
};

export interface IngestionResponse {
  success: boolean;
  advisors_ingested: number;
  message: string;
}

export const ingestionApi = {
  loadSample: () => api.post<IngestionResponse>("/api/ingestion/sample"),
  uploadJson: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<IngestionResponse>("/api/ingestion/json", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const chatApi = {
  send: (message: string, history?: ChatMessage[]) =>
    api.post<{ reply: string }>("/api/chat/", { message, history }),
};
