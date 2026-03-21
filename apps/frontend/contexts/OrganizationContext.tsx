'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type AuthOrganization, useAuth } from './AuthContext';

const ORG_STORAGE_KEY = 'docshare_org_id';

interface OrgContextValue {
  organizationId: string | null;
  setOrganizationId: (id: string) => void;
  currentOrg: AuthOrganization | null;
}

const OrgContext = createContext<OrgContextValue>({
  organizationId: null,
  setOrganizationId: () => {},
  currentOrg: null,
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { organizations, activeOrganizationId } = useAuth();
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationIdState] = useState<string | null>(null);

  // Initialize: prefer server's activeOrganizationId, then localStorage, then first org
  useEffect(() => {
    if (organizations.length === 0) return;

    const stored = localStorage.getItem(ORG_STORAGE_KEY);
    const validIds = organizations.map((o) => o.id);

    let id: string | null = null;
    if (activeOrganizationId && validIds.includes(activeOrganizationId)) {
      id = activeOrganizationId;
    } else if (stored && validIds.includes(stored)) {
      id = stored;
    } else if (organizations.length > 0) {
      id = organizations[0].id;
    }

    setOrganizationIdState(id);
  }, [organizations, activeOrganizationId]);

  const setOrganizationId = useCallback(
    (id: string) => {
      const prev = organizationId;
      setOrganizationIdState(id);
      localStorage.setItem(ORG_STORAGE_KEY, id);

      // Invalidate all org-scoped queries when switching
      if (prev && prev !== id) {
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey.includes(prev),
        });
      }
    },
    [organizationId, queryClient],
  );

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === organizationId) ?? null,
    [organizations, organizationId],
  );

  const value = useMemo(
    () => ({ organizationId, setOrganizationId, currentOrg }),
    [organizationId, setOrganizationId, currentOrg],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrganization() {
  return useContext(OrgContext);
}
