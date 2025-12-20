import { useAuth } from "./useAuth";

export function useTenant() {
  const { profile } = useAuth();
  return {
    tenantId: profile?.tenant_id ?? null,
    isLoading: !profile,
  };
}
