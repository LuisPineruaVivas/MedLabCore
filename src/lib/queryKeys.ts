export const queryKeys = {
  auth: ["auth"] as const,
  profile: (userId: string | null | undefined) => ["profile", userId ?? "anonymous"] as const,
  organization: (orgId: string | null | undefined) => ["organization", orgId ?? "none"] as const,
  organizations: ["organizations"] as const,
  currentOrgContext: (userId: string | null | undefined) => ["current-org-context", userId ?? "anonymous"] as const,
  exchangeRate: (orgId: string | null | undefined) => ["exchange-rate", orgId ?? "none"] as const,
  orders: {
    all: (orgId: string | null | undefined) => ["orders", orgId ?? "none"] as const,
    list: (
      orgId: string | null | undefined,
      filters: Record<string, string | number | null | undefined>
    ) => ["orders", orgId ?? "none", filters] as const,
    detail: (orderId: string | null | undefined) => ["order", orderId ?? "none"] as const,
    items: (orderId: string | null | undefined, orgId: string | null | undefined) =>
      ["order-items", orderId ?? "none", orgId ?? "none"] as const,
    stats: (orgId: string | null | undefined) => ["orders-stats", orgId ?? "none"] as const,
    billing: (
      orgId: string | null | undefined,
      filters: Record<string, string | number | null | undefined>
    ) => ["billing-orders", orgId ?? "none", filters] as const,
  },
  patients: {
    all: (orgId: string | null | undefined) => ["patients", orgId ?? "none"] as const,
    list: (
      orgId: string | null | undefined,
      filters: Record<string, string | number | null | undefined>
    ) => ["patients", orgId ?? "none", filters] as const,
    detail: (patientId: string | null | undefined) => ["patient", patientId ?? "none"] as const,
    orders: (patientId: string | null | undefined) => ["patient-orders", patientId ?? "none"] as const,
    stats: (orgId: string | null | undefined) => ["patient-stats", orgId ?? "none"] as const,
    search: (orgId: string | null | undefined, search: string) =>
      ["patient-search", orgId ?? "none", search] as const,
  },
  testTemplates: {
    list: (
      orgId: string | null | undefined,
      filters: Record<string, string | number | null | undefined>
    ) => ["test-templates", orgId ?? "none", filters] as const,
    stats: (orgId: string | null | undefined) => ["test-templates-stats", orgId ?? "none"] as const,
    orderTemplates: (orgId: string | null | undefined) => ["order-templates", orgId ?? "none"] as const,
    categories: (orgId: string | null | undefined) => ["test-categories", orgId ?? "none"] as const,
    departmentOrder: (orgId: string | null | undefined) => ["department-order", orgId ?? "none"] as const,
    profileBuilderTemplates: (orgId: string | null | undefined) =>
      ["profile-builder-templates", orgId ?? "none"] as const,
    orderByCategory: (orgId: string | null | undefined, category: string | null | undefined) =>
      ["order-templates", orgId ?? "none", category ?? "all"] as const,
  },
  examProfiles: {
    list: (orgId: string | null | undefined) => ["exam-profiles", orgId ?? "none"] as const,
    orderProfiles: (orgId: string | null | undefined) => ["order-profiles", orgId ?? "none"] as const,
  },
  dashboard: {
    stats: (orgId: string | null | undefined, exchangeRateUpdatedAt: string | null | undefined) =>
      ["dashboard-stats", orgId ?? "none", exchangeRateUpdatedAt ?? "none"] as const,
    recentOrders: (orgId: string | null | undefined) => ["dashboard-recent-orders", orgId ?? "none"] as const,
    topTests: (orgId: string | null | undefined) => ["dashboard-top-tests", orgId ?? "none"] as const,
  },
  settings: {
    teamMembers: (orgId: string | null | undefined) => ["team-members", orgId ?? "none"] as const,
    organization: (orgId: string | null | undefined) => ["organization-settings", orgId ?? "none"] as const,
    profile: (userId: string | null | undefined) => ["profile-settings", userId ?? "none"] as const,
    manualExchangeRate: (orgId: string | null | undefined) =>
      ["manual-exchange-rate", orgId ?? "none"] as const,
  },
  affiliateAccounts: {
    affiliates: (orgId: string | null | undefined, role: string | null | undefined) =>
      ["affiliate-accounts", "affiliates", orgId ?? "none", role ?? "none"] as const,
    hasAffiliates: (orgId: string | null | undefined, role: string | null | undefined) =>
      ["affiliate-accounts", "has-affiliates", orgId ?? "none", role ?? "none"] as const,
    orders: (
      affiliateId: string | null | undefined,
      filters: Record<string, string | number | null | undefined>
    ) => ["affiliate-accounts", "orders", affiliateId ?? "none", filters] as const,
    pendingBalance: (affiliateId: string | null | undefined) =>
      ["affiliate-accounts", "pending-balance", affiliateId ?? "none"] as const,
  },
} as const;
