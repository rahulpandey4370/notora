'use client';

import { useEffect } from 'react';
import type { AIProvider } from '@/lib/model-catalog';
import { useModelStore } from '@/hooks/use-model-store';

/**
 * Pushes the server-resolved provider list into the client model store.
 *
 * The store is created in the browser, where non-public env vars don't exist,
 * so it can't work out on its own which providers have credentials. The server
 * layout computes that and hands it down through this component.
 */
export default function ModelCatalogSync({ providers }: { providers: AIProvider[] }) {
  const hydrateProviders = useModelStore(s => s.hydrateProviders);

  useEffect(() => {
    hydrateProviders(providers);
    // `providers` comes from the server as a fresh array each render; compare
    // by value so this only re-runs when the list actually changes.
  }, [hydrateProviders, providers.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
