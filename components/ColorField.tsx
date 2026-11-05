import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colorSwatches } from '../lib/colorSwatches';
import { useTheme } from './Theme';

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (color: string) => void;
};

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  function pick(color: string) {
    onChange(color);
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <Pressable
        style={[styles.trigger, { borderColor: theme.border }]}
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label}: выбрать цвет`}
      >
        <View style={[styles.swatch, { backgroundColor: value, borderColor: theme.border }]} />
        <Text style={[styles.value, { color: theme.text }]}>{value.toUpperCase()}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.dialog, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.title, { color: theme.text }]}>{label}</Text>
            <ScrollView contentContainerStyle={styles.grid} style={styles.gridScroll}>
              {colorSwatches.map((color) => {
                const selected = color.toLowerCase() === value.toLowerCase();
                return (
                  <Pressable
                    key={color}
                    onPress={() => pick(color)}
                    style={[
                      styles.option,
                      { backgroundColor: color, borderColor: selected ? theme.accent : theme.border },
                      selected && styles.optionSelected,
                    ]}
                    accessibilityLabel={color}
                  />
                );
              })}
            </ScrollView>
            <Pressable style={[styles.close, { borderColor: theme.accent }]} onPress={() => setOpen(false)}>
              <Text style={[styles.closeLabel, { color: theme.text }]}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  value: {
    fontSize: 15,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  gridScroll: {
    maxHeight: 320,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 8,
  },
  option: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  optionSelected: {
    borderWidth: 3,
  },
  close: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeLabel: {
    fontSize: 16,
  },
});
