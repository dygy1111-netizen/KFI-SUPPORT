export type View = "home" | "schedule" | "procedure" | "cases" | "manual" | "resources" | "admin";

export type SiteConfig = {
  organization: string;
  siteTitle: string;
  navHome: string;
  navSchedule: string;
  navProcedure: string;
  navCases: string;
  navManual: string;
  navResources: string;
  navAdmin: string;
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroText: string;
  scheduleTitle: string;
  scheduleText: string;
  scheduleCardText: string;
  procedureTitle: string;
  procedureText: string;
  procedureCardText: string;
  casesTitle: string;
  casesText: string;
  casesCardText: string;
  manualTitle: string;
  manualText: string;
  manualCardText: string;
  resourcesTitle: string;
  resourcesText: string;
  resourcesCardText: string;
  footerNotice: string;
};

export type CaseItem = {
  id: number;
  category: string;
  title: string;
  summary: string;
  cause: string;
  action: string;
  standard: string;
  status: "부적합" | "보완";
  published: boolean;
  before_image_path: string | null;
  after_image_path: string | null;
};

export type ManualItem = {
  id: number;
  category: string;
  title: string;
  summary: string;
  body: string;
  faq: boolean;
  published: boolean;
};

export type ResourceItem = {
  id: number;
  category: string;
  title: string;
  description: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  published: boolean;
};

export type PortalContent = {
  config: SiteConfig;
  cases: CaseItem[];
  manuals: ManualItem[];
  resources: ResourceItem[];
};
