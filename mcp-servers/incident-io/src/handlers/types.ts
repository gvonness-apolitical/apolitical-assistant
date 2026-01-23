// API Response Types for Incident.io

export interface Incident {
  id: string;
  name: string;
  incident_status: { category: string; name: string };
  severity?: { name: string };
  created_at: string;
  updated_at: string;
  incident_role_assignments?: Array<{
    role: { name: string };
    assignee?: { name: string };
  }>;
  postmortem_document_url?: string;
  summary?: string;
  custom_field_entries?: Array<{
    custom_field: { name: string };
    values: Array<{ value_text?: string }>;
  }>;
  permalink?: string;
}

export interface FollowUp {
  id: string;
  title: string;
  description?: string;
  status: { name: string };
  assignee?: { name: string; email: string };
  incident: { id: string; name: string };
  created_at: string;
  completed_at?: string;
}

export interface Severity {
  id: string;
  name: string;
  description?: string;
  rank: number;
}
