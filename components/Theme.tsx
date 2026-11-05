import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { loadThemeChoice, saveThemeChoice } from '../lib/db';
import {
  defaultThemeChoice,
  themeOf,
  type Theme,
  type ThemeChoice,
} from '../lib/theme';

type ThemeContextValue = {
  theme: Theme;
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(defaultThemeChoice);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadThemeChoice()
      .then(setChoiceState)
      .catch(() => setChoiceState(defaultThemeChoice()))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: themeOf(choice),
    choice,
    setChoice: async (next) => {
      setChoiceState(next);
      await saveThemeChoice(next);
    },
  }), [choice]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {ready ? null : (
        <View style={[styles.boot, { backgroundColor: value.theme.background }]} pointerEvents="auto">
          <ActivityIndicator color={value.theme.accent} />
        </View>
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('Тема недоступна');
  }
  return value;
}

const styles = StyleSheet.create({
  boot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
