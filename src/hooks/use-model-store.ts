
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ModelId } from '@/lib/types';
import {
  availableModels as catalogModels,
  defaultModelKey,
  type AIProvider,
  type CatalogModel,
} from '@/lib/model-catalog';

interface ModelStoreState {
  availableModels: CatalogModel[];
  selectedModel: ModelId;
  setModel: (modelId: ModelId) => void;
  /** The header's web search switch: AI features search the web only while it's on. */
  webSearch: boolean;
  setWebSearch: (on: boolean) => void;
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
      webSearch: false,
      setWebSearch: (on) => set({ webSearch: on }),
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
      // Only the web search switch is persisted. The model starts on the
      // default (GPT-6 Luna) at every launch; a pick in the header lasts until
      // the next launch. The catalog always comes from code.
      partialize: (state) => ({ webSearch: state.webSearch }),
      merge: (persisted, current) => ({
        ...current,
        webSearch: (persisted as { webSearch?: boolean } | undefined)?.webSearch === true,
      }),
    }
  )
);
