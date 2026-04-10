export interface Appointment {
  id: string;
  company_id: string;
  name: string | null;
  closer_name: string | null;
  booked_for: string | null;
  notes: string | null;
  phone_number: string | null;
  address: string | null;
  setter_name: string | null;
  email: string | null;
  disposition_date: string | null;
  site_survey: string | null;
  m1_commission: number | null;
  m2_commission: number | null;
  contact_link: string | null;
  recording_media_link: string | null;
  credit_score: string | null;
  roof_type: string | null;
  existing_solar: string | null;
  shading: string | null;
  appointment_type: string | null;
  confirmed: boolean | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
  dq_reason: string | null;
  system_size: string | null;
  disposition_status: string | null;
  job_size: string | null;
  "Company Name": string | null;
}

export interface Client {
  id: string;
  company_id: string;
  company_name: string;
  seats_purchased: number;
  seats_active: number;
  onboarding_date: string | null;
  launch_date: string | null;
  status: "active" | "paused" | "churned";
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientMetrics {
  companyId: string;
  companyName: string;
  status: string;
  seatsPurchased: number;
  activeAgents: number;
  totalAppointments: number;
  achievement: number;
  agents: AgentMetrics[];
}

export interface AgentMetrics {
  setterName: string;
  companyId: string;
  companyName: string;
  appointmentsBooked: number;
  weeklyAvg: number;
  achievement: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  companyName?: string;
  achievement: number;
  appointments: number;
  seats?: number;
  weeklyAvg?: number;
}

export interface WeekRange {
  start: Date;
  end: Date;
  label: string;
}

export interface HistoricalCell {
  count: number;
  achievement: number;
}

export type AchievementTier = "blue" | "orange" | "red" | "all";

export type TimeFilter = "week" | "month" | "custom";

export type ViewType = "overview" | "clients" | "leaderboard" | "historical" | "leads" | "settings"
  | "fe_overview" | "fe_pipeline" | "fe_leads";

export type DashboardMode = "backend" | "frontend";

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface FrontendMetric {
  id: string;
  "Lead Name": string | null;
  "Booked For": string | null;
  "Created At": string | null;
  "Campaign Name": string | null;
  "Closer": string | null;
  "Phone Number": string | null;
  "Email Address": string | null;
  "Status / Stage in Pipeline": string | null;
  "Setter": string | null;
  "Appointment Booked": string | null;
  "Date Appointment Booked": string | null;
  "Appointment Show": string | null;
  "Appointment Status": string | null;
  "Pitch": string | null;
  "Disposition/Outcome": string | null;
  "Notes/Comments": string | null;
  "Deal Value": string | null;
  "Cash Collected": string | null;
  "GHL Contact Link": string | null;
  "Source Campaign": string | null;
  "Tag(s)": string | null;
}

export interface FilterState {
  dateRange: DateRange;
  selectedClients: string[];
  achievementTier: AchievementTier;
  searchQuery: string;
  timeFilter: TimeFilter;
}
