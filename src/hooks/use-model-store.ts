
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ModelId } from '@/lib/types';
import { modelNames } from '@/lib/types';

interface ModelStoreState {
  availableModels: readonly ModelId[];
  selectedModel: ModelId;
  setModel: (modelId: ModelId) => void;
}

export const useModelStore = create<ModelStoreState>()(
  persist(
    (set) => ({
      availableModels: modelNames,
      selectedModel: 'gemini-2.5-flash',
      setModel: (modelId) => set({ selectedModel: modelId }),
    }),
    {
      name: 'notora-model-selection',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedModel: state.selectedModel }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.availableModels = modelNames;
          if (!modelNames.includes(state.selectedModel as any)) {
            state.selectedModel = 'gemini-2.5-flash';
          }
        }
      },
    }
  )
);
