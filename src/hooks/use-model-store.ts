
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ModelId } from '@/lib/types';
import {
  availableModels as catalogModels,
  defaultModelKey,
  modelForArea,
  startModelKey,
  type AIProvider,
  type ModelArea,
  type CatalogModel,
} from '@/lib/model-catalog';

interface ModelStoreState {
  availableModels: CatalogModel[];
  selectedModel: ModelId;
  /** The model the user chose themselves, remembered on this device; null until they choose one. */
  pickedModel: ModelId | null;
  setModel: (modelId: ModelId) => void;
  /** A different model for one part of the app; areas not listed use the default pick. */
  areaModels: Partial<Record<ModelArea, ModelId>>;
  setAreaModel: (area: ModelArea, modelId: ModelId | null) => void;
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
      pickedModel: null,
      setModel: (modelId) => set({ selectedModel: modelId, pickedModel: modelId }),
      areaModels: {},
      setAreaModel: (area, modelId) => set((state) => {
        const next = { ...state.areaModels };
        if (modelId) next[area] = modelId; else delete next[area];
        return { areaModels: next };
      }),
      webSearch: false,
      setWebSearch: (on) => set({ webSearch: on }),
      hydrateProviders: (providers) =>
        set((state) => ({
          availableModels: catalogModels(providers),
          // The user's own pick if it's still on offer, else the default for the
          // server's list (GPT-6 Luna). Never the pre-hydration guess: see startModelKey.
          selectedModel: startModelKey(providers, state.pickedModel),
        })),
    }),
    {
      name: 'notora-model-selection',
      storage: createJSONStorage(() => localStorage),
      // Persisted: the web search switch and the model the user picked. With no
      // pick the app starts on the default (GPT-6 Luna). The catalog always comes from code.
      partialize: (state) => ({ webSearch: state.webSearch, pickedModel: state.pickedModel, areaModels: state.areaModels }),
      merge: (persisted, current) => {
        const p = persisted as { webSearch?: boolean; pickedModel?: unknown; areaModels?: unknown } | undefined;
        const areas = p?.areaModels && typeof p.areaModels === 'object'
          ? Object.fromEntries(Object.entries(p.areaModels as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v)) as ModelStoreState['areaModels'] : {};
        const picked = typeof p?.pickedModel === 'string' && p.pickedModel ? p.pickedModel : null;
        return { ...current, webSearch: p?.webSearch === true, pickedModel: picked, selectedModel: picked ?? current.selectedModel, areaModels: areas };
      },
    }
  )
);

/** The model one part of the app should use: its own choice in AI models, else the default pick. */
export const useModelFor = (area: ModelArea): ModelId =>
  useModelStore((s) => modelForArea(s.availableModels, s.selectedModel, s.areaModels[area]));
