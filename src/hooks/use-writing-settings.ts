'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useMemo } from 'react';

type WritingFont = 'font-body' | 'font-serif' | 'font-mono';

interface WritingSettingsState {
  font: WritingFont;
  size: number;
  spacing: number;
  setFont: (font: WritingFont) => void;
  setSize: (size: number) => void;
  setSpacing: (spacing: number) => void;
}

const useWritingSettingsStore = create<WritingSettingsState>()(
  persist(
    (set) => ({
      font: 'font-body',
      size: 16,
      spacing: 1.5,
      setFont: (font) => set({ font }),
      setSize: (size) => set({ size }),
      setSpacing: (spacing) => set({ spacing }),
    }),
    {
      name: 'notora-writing-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const useWritingSettings = () => {
    return useWritingSettingsStore();
};
