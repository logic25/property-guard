import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useAdminRole() {
  const { user } = useAuth();

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['admin-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { isAdmin: isAdmin ?? false, isLoading };
}
