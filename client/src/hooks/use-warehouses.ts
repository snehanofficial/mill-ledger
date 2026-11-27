import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";

export interface FacilityRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  state: string;
  isActive: boolean;
  _count?: { warehouses: number };
}

export interface WarehouseRecord {
  id: string;
  organizationId: string;
  facilityId: string;
  code: string;
  name: string;
  isActive: boolean;
  facility?: {
    id: string;
    code: string;
    name: string;
    state: string;
    isActive: boolean;
  };
}

export function useWarehouses(options?: {
  facilityId?: string;
  includeInactive?: boolean;
}) {
  return useQuery<{ warehouses: WarehouseRecord[] }>({
    queryKey: [
      "masters-warehouses",
      options?.facilityId ?? null,
      Boolean(options?.includeInactive),
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.facilityId) params.set("facilityId", options.facilityId);
      if (options?.includeInactive) params.set("includeInactive", "true");
      const qs = params.toString();
      const endpoint = qs ? `/masters/warehouses?${qs}` : "/masters/warehouses";
      const res = await apiClient.get(endpoint);
      return assertCollectionResponse(res.data, "warehouses", endpoint);
    },
  });
}

export function useFacilities(includeInactive = false) {
  return useQuery<{ facilities: FacilityRecord[] }>({
    queryKey: ["masters-facilities", includeInactive],
    queryFn: async () => {
      const qs = includeInactive ? "?includeInactive=true" : "";
      const endpoint = `/masters/facilities${qs}`;
      const res = await apiClient.get(endpoint);
      return assertCollectionResponse(res.data, "facilities", endpoint);
    },
  });
}
