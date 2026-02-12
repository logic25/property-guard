import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

export interface ComplianceScore {
  id: string;
  property_id: string;
  score: number;
  grade: string;
  violation_score: number;
  compliance_score: number;
  resolution_score: number;
  violation_details: Record<string, number>;
  compliance_details: Record<string, number>;
  resolution_details: Record<string, number>;
  calculated_at: string;
}

export function useComplianceScore(propertyId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: score, isLoading } = useQuery({
    queryKey: ['compliance-score', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from('compliance_scores')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ComplianceScore | null;
    },
    enabled: !!user && !!propertyId,
  });

  const recalculate = useCallback(async () => {
    if (!propertyId) return;
    const { data, error } = await supabase.rpc('calculate_compliance_score', {
      p_property_id: propertyId,
    });
    if (error) {
      console.error('Failed to recalculate compliance score:', error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['compliance-score', propertyId] });
    return data;
  }, [propertyId, queryClient]);

  return { score, isLoading, recalculate };
}

export function usePortfolioScores() {
  const { user } = useAuth();

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['compliance-scores-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_scores')
        .select('*')
        .order('score', { ascending: true });
      if (error) throw error;
      return data as unknown as ComplianceScore[];
    },
    enabled: !!user,
  });

  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : null;

  const averageGrade = averageScore !== null
    ? averageScore >= 90 ? 'A' : averageScore >= 80 ? 'B' : averageScore >= 70 ? 'C' : averageScore >= 60 ? 'D' : 'F'
    : null;

  return { scores, averageScore, averageGrade, isLoading };
}
