
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ModelId } from '@/lib/types';
import {
  availableModels as catalogModels,
  defaultModelKey,
  resolveModel,
  type AIProvider,
  type CatalogModel,
} from '@/lib/model-catalog';

interface ModelStoreState {
  availableModels: CatalogModel[];
  selectedModel: ModelId;
  setModel: (modelId: ModelId) => void;
  /**
   * Replace the catalog with the list the SERVER resolved from real API keys.
   * The client cannot see non-public env vars, so without this the picker is
   * stuck with whatever `NEXT_PUBLIC_AI_PROVIDERS` happened to be at build time.
   */
  hydrateProviders: (providers: AIProvider[]) => void;
}

export const useModelStore = create<ModelStoreState>()(
  persist(
    (set) => ({
      availableModels: catalogModels(),
      selectedModel: defaultModelKey(),
      setModel: (modelId) => set({ selectedModel: modelId }),
      hydrateProviders: (providers) =>
        set((state) => {
          const models = catalogModels(providers);
          // Keep the current pick if its provider is still enabled, else fall
          // back to the default for the new list.
          const stillValid = models.some((m) => m.key === state.selectedModel);
          return {
            availableModels: models,
            selectedModel: stillValid ? state.selectedModel : defaultModelKey(providers),
          };
        }),
    }),
    {
      name: 'notora-model-selection',
      storage: createJSONStorage(() => localStorage),
      // Only the selection is worth persisting. The catalog must come from code
      // so newly-added models appear immediately instead of being pinned to
      // whatever list was cached in localStorage on a previous visit.
      partialize: (state) => ({ selectedModel: state.selectedModel }),
      merge: (persisted, current) => {
        const stored = (persisted as { selectedModel?: string } | undefined)?.selectedModel;
        // Migrate a bare id (pre-key) to its key, and drop a selection whose
        // provider is no longer enabled.
        const resolved = resolveModel(stored);
        return {
          ...current,
          availableModels: catalogModels(),
          selectedModel: resolved?.key ?? defaultModelKey(),
        };
      },
    }
  )
);
