export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioWithStats extends Portfolio {
  property_count: number;
  total_violations: number;
  open_violations: number;
  critical_violations: number;
}
