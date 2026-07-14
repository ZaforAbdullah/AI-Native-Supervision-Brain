export const SAMPLE_ADVISOR_INGESTION_DATA = [
  {
    advisor_ref: "ADV10099",
    full_name: "Jane Doe",
    firm_name: "Example Wealth Management",
    firm_ref: "FIRM001",
    status: "active",
    enhanced_financial_monitoring: false,
    mortgage_lender_spread: [
      { lender: "Halifax", percentage: 40, case_count: 12 },
      { lender: "Nationwide", percentage: 35, case_count: 10 },
      { lender: "Barclays", percentage: 25, case_count: 7 },
    ],
    protection_provider_spread: [
      { provider: "Aviva", percentage: 55, case_count: 9, avg_commission_rate: 0.18, is_high_commission: false },
      { provider: "Legal & General", percentage: 45, case_count: 7, avg_commission_rate: 0.16, is_high_commission: false },
    ],
    file_review_results: [
      { month: "Jan 2026", grade: "B", cases_reviewed: 9, passed: 8, failed: 1 },
      { month: "Feb 2026", grade: "A", cases_reviewed: 10, passed: 10, failed: 0 },
    ],
    file_review_deficiencies: [
      { code: "FR-014", description: "Missing suitability rationale", count: 1, lender_related: "Halifax" },
    ],
  },
  {
    advisor_ref: "ADV10100",
    full_name: "John Smith",
    firm_name: "Prestige Mortgage Solutions",
    firm_ref: "FIRM002",
    status: "active",
    enhanced_financial_monitoring: true,
    mortgage_lender_spread: [
      { lender: "Santander", percentage: 72, case_count: 18 },
      { lender: "Halifax", percentage: 28, case_count: 7 },
    ],
    protection_provider_spread: [
      { provider: "ProviderB", percentage: 68, case_count: 14, avg_commission_rate: 0.28, is_high_commission: true },
      { provider: "Zurich", percentage: 32, case_count: 6, avg_commission_rate: 0.15, is_high_commission: false },
    ],
    file_review_results: [
      { month: "Jan 2026", grade: "D", cases_reviewed: 8, passed: 5, failed: 3 },
      { month: "Feb 2026", grade: "C", cases_reviewed: 9, passed: 6, failed: 3 },
    ],
    file_review_deficiencies: [
      { code: "FR-022", description: "Incomplete fact-find", count: 2, lender_related: null },
      { code: "FR-031", description: "Fee disclosure gap", count: 1, lender_related: "Santander" },
    ],
  },
];
