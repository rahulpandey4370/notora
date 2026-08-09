
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ModelId } from '@/lib/types';
import {
  availableModels as catalogModels,
  defaultModelKey,
  resolveModel,
  type CatalogModel,
} from '@/lib/model-catalog';

interface ModelStoreState {
  availableModels: CatalogModel[];
  selectedModel: ModelId;
  setModel: (modelId: ModelId) => void;
}

export const useModelStore = create<ModelStoreState>()(
  persist(
    (set) => ({
      availableModels: catalogModels(),
      selectedModel: defaultModelKey(),
      setModel: (modelId) => set({ selectedModel: modelId }),
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
