import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ColorField } from '../components/ColorField';
import { Screen } from '../components/Screen';
import { useTheme } from '../components/Theme';
import {
  paletteFields,
  paletteOf,
  presets,
  resolveTheme,
  themeOf,
  type Palette,
  type ThemePreset,
} from '../lib/theme';

const presetOrder: ThemePreset[] = [
  'light',
  'dark',
  'sand',
  'blue',
  'gradientTeal',
  'gradientPink',
  'gradientOrange',
  'gradientSky',
];

export default function SettingsScreen() {
  const { theme, choice, setChoice } = useTheme();
  const [draft, setDraft] = useState<Palette>(paletteOf(choice));
  const [gradientEnabled, setGradientEnabled] = useState(
    choice.preset === 'custom' && Array.isArray(choice.customGradient),
  );
  const [gradientDraft, setGradientDraft] = useState<readonly [string, string]>(
    choice.customGradient ?? ['#0f172a', '#134e4a'],
  );

  const preview = choice.preset === 'custom'
    ? resolveTheme(draft, gradientEnabled ? gradientDraft : undefined)
    : themeOf(choice);

  function selectPreset(preset: ThemePreset) {
    setDraft(presets[preset].palette);
    setChoice({
      preset,
      custom: choice.custom,
      customGradient: choice.customGradient ?? null,
    });
  }

  function commitCustom(nextPalette: Palette, nextGradient: readonly [string, string] | null) {
    setDraft(nextPalette);
    setChoice({
      preset: 'custom',
      custom: nextPalette,
      customGradient: nextGradient,
    });
  }

  function updateColor(key: keyof Palette, value: string) {
    const next = { ...draft, [key]: value };
    commitCustom(next, gradientEnabled ? gradientDraft : null);
  }

  function toggleGradient() {
    const enabled = !gradientEnabled;
    setGradientEnabled(enabled);
    commitCustom(draft, enabled ? gradientDraft : null);
  }

  function updateGradient(index: 0 | 1, value: string) {
    const next: [string, string] = [...gradientDraft] as [string, string];
    next[index] = value;
    setGradientDraft(next);
    if (gradientEnabled) {
      commitCustom(draft, next);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Настройки' }} />
      <Text style={[styles.section, { color: theme.text }]}>Темы</Text>
      {presetOrder.map((preset) => {
        const selected = choice.preset === preset;
        const def = presets[preset];
        const gradient = def.gradientColors;
        return (
          <Pressable
            key={preset}
            style={[styles.preset, { borderColor: selected ? theme.accent : theme.border }]}
            onPress={() => selectPreset(preset)}
          >
            {gradient ? (
              <LinearGradient
                colors={[gradient[0], gradient[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.presetGradient}
              >
                <Text style={[styles.presetLabel, { color: def.palette.text }]}>{def.name}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.presetFill, { backgroundColor: def.palette.background }]}>
                <Text style={[styles.presetLabel, { color: def.palette.text }]}>{def.name}</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      <Text style={[styles.section, { color: theme.text }]}>Своя</Text>
      {paletteFields.map((field) => (
        <ColorField
          key={field.key}
          label={field.label}
          value={draft[field.key]}
          onChange={(color) => updateColor(field.key, color)}
        />
      ))}

      <Pressable
        style={[styles.toggle, { borderColor: gradientEnabled ? theme.accent : theme.border }]}
        onPress={toggleGradient}
      >
        <Text style={[styles.toggleLabel, { color: theme.text }]}>
          Градиентный фон {gradientEnabled ? 'вкл.' : 'выкл.'}
        </Text>
      </Pressable>

      {gradientEnabled ? (
        <>
          <ColorField
            label="Градиент: начало"
            value={gradientDraft[0]}
            onChange={(color) => updateGradient(0, color)}
          />
          <ColorField
            label="Градиент: конец"
            value={gradientDraft[1]}
            onChange={(color) => updateGradient(1, color)}
          />
        </>
      ) : null}

      <Text style={[styles.section, { color: theme.text }]}>Предпросмотр</Text>
      <View style={[styles.previewWrap, { borderColor: preview.border }]}>
        {preview.gradientColors ? (
          <LinearGradient
            colors={[preview.gradientColors[0], preview.gradientColors[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.preview}
          >
            <PreviewContent preview={preview} />
          </LinearGradient>
        ) : (
          <View style={[styles.preview, { backgroundColor: preview.background }]}>
            <PreviewContent preview={preview} />
          </View>
        )}
      </View>
    </Screen>
  );
}

function PreviewContent({ preview }: { preview: ReturnType<typeof resolveTheme> }) {
  return (
    <>
      <Text style={[styles.previewText, { color: preview.text }]}>Текст</Text>
      <View style={[styles.previewButton, { backgroundColor: preview.accent }]}>
        <Text style={{ color: preview.accentText }}>Кнопка</Text>
      </View>
      <Text style={[styles.chip, { backgroundColor: preview.success, color: preview.text }]}>Получилось</Text>
      <Text style={[styles.chip, { backgroundColor: preview.fail, color: preview.text }]}>Не получилось</Text>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 8,
  },
  preset: {
    borderWidth: 2,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  presetFill: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  presetGradient: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  presetLabel: {
    fontSize: 16,
  },
  toggle: {
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 16,
  },
  previewWrap: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  preview: {
    padding: 12,
    gap: 8,
  },
  previewText: {
    fontSize: 16,
  },
  previewButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chip: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
