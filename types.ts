export interface Submission {
  id: number;
  name: string;
  category: string;
  roll: string;
  marks: string;
  admit_card_path: string | null;
  admit_card_filename: string | null;
  created_at: string;
}

export interface AppSettings {
  allow_submissions: number;
  allow_user_edits: number;
  allow_uploads: number;
}

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export interface ActionResult {
  success?: boolean;
  error?: string;
  id?: number;
}

export interface DashboardStats {
  total: number;
  withAdmitCard: number;
  withoutAdmitCard: number;
  highestMarks: number | null;
  averageMarks: string | null;
  lowestMarks: number | null;
  medianMarks: number | string | null;
  categoryCount: number;
  topCategory: string | null;
  topCategoryAvg: string | null;
}

