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

const fontClassMapping: Record<WritingFont, string> = {
    'font-body': 'font-sans',
    'font-serif': 'font-serif',
    'font-mono': 'font-mono',
};

export const useWritingSettings = () => {
    const font = useWritingSettingsStore((state) => state.font);
    const size = useWritingSettingsStore((state) => state.size);
    const spacing = useWritingSettingsStore((state) => state.spacing);
    const setFont = useWritingSettingsStore((state) => state.setFont);
    const setSize = useWritingSettingsStore((state) => state.setSize);
    const setSpacing = useWritingSettingsStore((state) => state.setSpacing);

    const mappedFont = useMemo(() => fontClassMapping[font], [font]);
    
    const settingsStyle = useMemo(() => ({
        fontSize: `${size}px`,
        lineHeight: spacing,
    }), [size, spacing]);

    return useMemo(() => ({
        font: mappedFont,
        size,
        spacing,
        rawFont: font,
        setFont,
        setSize,
        setSpacing,
        settingsStyle,
    }), [mappedFont, size, spacing, font, setFont, setSize, setSpacing, settingsStyle]);
};
