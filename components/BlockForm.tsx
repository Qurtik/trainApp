import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import {
  formatWeight,
  kgToLbs,
  lbsToKg,
  parsePositiveNumber,
  roundKg,
} from '../lib/format';
import { useScreenScroll } from './Screen';
import { useTheme } from './Theme';

const reorderTransition = LinearTransition.duration(250);
const FOCUS_AFTER_ADD_MS = 200;

export type BlockFormHandle = {
  addExercise: () => void;
};

export type DraftFields = {
  id?: number;
  clientKey: string;
  name: string;
  sets: string;
  reps: string;
  weightStep: string;
  startingWeight: string;
};

export type SlotDraft = {
  clientKey: string;
  slotId?: number;
  variants: DraftFields[];
};

let clientKeySeq = 0;

export function emptyExercise(): DraftFields {
  clientKeySeq += 1;
  return {
    clientKey: `ex-${Date.now()}-${clientKeySeq}`,
    name: '',
    sets: '3',
    reps: '12',
    weightStep: '2.5',
    startingWeight: '',
  };
}

export function emptySlot(): SlotDraft {
  clientKeySeq += 1;
  return {
    clientKey: `slot-${Date.now()}-${clientKeySeq}`,
    variants: [emptyExercise()],
  };
}

type BlockFormProps = {
  name: string;
  onNameChange: (value: string) => void;
  slots: SlotDraft[];
  onSlotsChange: (slots: SlotDraft[]) => void;
};

type BlockFormActionsProps = {
  error: string | null;
  saving: boolean;
  saveLabel: string;
  onAdd: () => void;
  onSave: () => void;
};

export function BlockFormActions({
  error,
  saving,
  saveLabel,
  onAdd,
  onSave,
}: BlockFormActionsProps) {
  const { theme } = useTheme();
  return (
    <>
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={onAdd}>
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>Добавить упражнение</Text>
      </Pressable>
      <Pressable
        style={[styles.primary, { backgroundColor: theme.accent }, saving && styles.disabled]}
        disabled={saving}
        onPress={onSave}
      >
        <Text style={[styles.primaryLabel, { color: theme.accentText }]}>
          {saving ? 'Сохранение...' : saveLabel}
        </Text>
      </Pressable>
    </>
  );
}

export const BlockForm = forwardRef<BlockFormHandle, BlockFormProps>(function BlockForm({
  name,
  onNameChange,
  slots,
  onSlotsChange,
}, ref) {
  const { theme } = useTheme();
  const [pendingFocusKey, setPendingFocusKey] = useState<string | null>(null);
  const clearPendingFocus = useCallback(() => setPendingFocusKey(null), []);

  const addExercise = useCallback(() => {
    const next = emptySlot();
    setPendingFocusKey(next.variants[0].clientKey);
    onSlotsChange([...slots, next]);
  }, [slots, onSlotsChange]);

  useImperativeHandle(ref, () => ({ addExercise }), [addExercise]);

  function updateSlot(index: number, patch: Partial<SlotDraft>) {
    onSlotsChange(slots.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  }

  function updateVariant(slotIndex: number, variantIndex: number, patch: Partial<DraftFields>) {
    const slot = slots[slotIndex];
    updateSlot(slotIndex, {
      variants: slot.variants.map((item, itemIndex) => (
        itemIndex === variantIndex ? { ...item, ...patch } : item
      )),
    });
  }

  function moveSlot(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slots.length) {
      return;
    }
    const next = [...slots];
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    onSlotsChange(next);
  }

  function addAlternative(slotIndex: number) {
    const next = emptyExercise();
    setPendingFocusKey(next.clientKey);
    const slot = slots[slotIndex];
    updateSlot(slotIndex, { variants: [...slot.variants, next] });
  }

  function removeVariant(slotIndex: number, variantIndex: number) {
    const slot = slots[slotIndex];
    if (slot.variants.length <= 1) {
      if (slots.length <= 1) {
        return;
      }
      onSlotsChange(slots.filter((_, itemIndex) => itemIndex !== slotIndex));
      return;
    }
    updateSlot(slotIndex, {
      variants: slot.variants.filter((_, itemIndex) => itemIndex !== variantIndex),
    });
  }

  return (
    <>
      <View style={[styles.blockCard, { borderColor: theme.text }]}>
        <Text style={[styles.blockLabel, { color: theme.text }]}>Название блока</Text>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          style={[styles.blockInput, { color: theme.text, borderColor: theme.text }]}
          placeholder="Например, Руки - 1"
          placeholderTextColor={theme.muted}
        />
      </View>
      {slots.map((slot, slotIndex) => (
        <Animated.View
          key={slot.clientKey}
          layout={reorderTransition}
          style={[styles.slot, { borderColor: theme.border }]}
        >
          <View style={styles.slotHeader}>
            <Text style={[styles.label, { color: theme.text }]}>Упражнение {slotIndex + 1}</Text>
            <View style={styles.headerActions}>
              <Pressable
                hitSlop={10}
                accessibilityLabel="Переместить вверх"
                disabled={slotIndex === 0}
                onPress={() => moveSlot(slotIndex, -1)}
              >
                <Text style={[styles.move, { color: slotIndex === 0 ? theme.border : theme.text }]}>↑</Text>
              </Pressable>
              <Pressable
                hitSlop={10}
                accessibilityLabel="Переместить вниз"
                disabled={slotIndex === slots.length - 1}
                onPress={() => moveSlot(slotIndex, 1)}
              >
                <Text style={[styles.move, { color: slotIndex === slots.length - 1 ? theme.border : theme.text }]}>↓</Text>
              </Pressable>
              {slots.length > 1 ? (
                <Pressable
                  hitSlop={12}
                  accessibilityLabel="Убрать упражнение"
                  onPress={() => onSlotsChange(slots.filter((_, itemIndex) => itemIndex !== slotIndex))}
                >
                  <Text style={[styles.remove, { color: theme.error }]}>×</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {slot.variants.map((variant, variantIndex) => (
            <ExerciseCard
              key={variant.clientKey}
              exercise={variant}
              label={variantIndex === 0 ? 'Вариант' : `Альтернатива ${variantIndex}`}
              canRemove={slot.variants.length > 1 || slots.length > 1}
              shouldFocus={variant.clientKey === pendingFocusKey}
              onFocused={clearPendingFocus}
              onUpdate={(patch) => updateVariant(slotIndex, variantIndex, patch)}
              onRemove={() => removeVariant(slotIndex, variantIndex)}
            />
          ))}
          <Pressable
            style={[styles.addAlt, { borderColor: theme.accent }]}
            onPress={() => addAlternative(slotIndex)}
          >
            <Text style={[styles.addAltLabel, { color: theme.text }]}>Добавить альтернативу</Text>
          </Pressable>
        </Animated.View>
      ))}
    </>
  );
});

function ExerciseCard({
  exercise,
  label,
  canRemove,
  shouldFocus,
  onFocused,
  onUpdate,
  onRemove,
}: {
  exercise: DraftFields;
  label: string;
  canRemove: boolean;
  shouldFocus: boolean;
  onFocused: () => void;
  onUpdate: (patch: Partial<DraftFields>) => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const { ensureVisible } = useScreenScroll();
  const cardRef = useRef<View>(null);
  const nameRef = useRef<TextInput>(null);
  const bodyweight = exercise.startingWeight.trim() === '';

  function handleFocus() {
    ensureVisible(cardRef);
  }

  useEffect(() => {
    if (!shouldFocus) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) {
        return;
      }
      nameRef.current?.focus();
      ensureVisible(cardRef);
      onFocused();
    }, FOCUS_AFTER_ADD_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shouldFocus, ensureVisible, onFocused]);

  return (
    <View ref={cardRef} collapsable={false} style={styles.variant}>
      <View style={styles.exerciseHeader}>
        <Text style={[styles.variantLabel, { color: theme.muted }]}>{label}</Text>
        {canRemove ? (
          <Pressable hitSlop={12} accessibilityLabel="Убрать вариант" onPress={onRemove}>
            <Text style={[styles.remove, { color: theme.error }]}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        ref={nameRef}
        value={exercise.name}
        onChangeText={(value) => onUpdate({ name: value })}
        onFocus={handleFocus}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholder="Название"
        placeholderTextColor={theme.muted}
      />
      <View style={styles.row}>
        <Field label="Подходы" value={exercise.sets} onChangeText={(value) => onUpdate({ sets: value })} onFocus={handleFocus} />
        <Field label="Повторения" value={exercise.reps} onChangeText={(value) => onUpdate({ reps: value })} onFocus={handleFocus} />
      </View>
      <View style={[styles.row, styles.weightRow]}>
        <WeightDualField
          label="Начальный вес"
          kgValue={exercise.startingWeight}
          onKgChange={(value) => onUpdate({ startingWeight: value })}
          onFocus={handleFocus}
          placeholder="пусто = свой"
          allowEmpty
        />
        {bodyweight ? (
          <View style={styles.field}>
            <Text numberOfLines={1} style={[styles.fieldLabel, { color: theme.muted }]}>Шаг</Text>
            <Text style={[styles.bodyweightHint, { color: theme.muted }]}>свой вес</Text>
          </View>
        ) : (
          <WeightDualField
            label="Шаг"
            kgValue={exercise.weightStep}
            onKgChange={(value) => onUpdate({ weightStep: value })}
            onFocus={handleFocus}
          />
        )}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  onFocus,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text numberOfLines={1} style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        style={[styles.fieldInput, { color: theme.text, borderColor: theme.border }]}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
      />
    </View>
  );
}

function WeightDualField({
  label,
  kgValue,
  onKgChange,
  onFocus,
  placeholder,
  allowEmpty,
}: {
  label: string;
  kgValue: string;
  onKgChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const { theme } = useTheme();
  const kgParsed = parsePositiveNumber(kgValue);
  const lbsDisplay = kgParsed === null ? '' : String(kgToLbs(kgParsed));
  const [lbsDraft, setLbsDraft] = useState(lbsDisplay);
  const editingLbs = useRef(false);

  useEffect(() => {
    if (!editingLbs.current) {
      setLbsDraft(lbsDisplay);
    }
  }, [lbsDisplay]);

  function handleKgChange(raw: string) {
    if (allowEmpty && raw.trim() === '') {
      onKgChange('');
      return;
    }
    if (raw === '' || raw === '.' || raw.endsWith('.') || raw.endsWith(',')) {
      onKgChange(raw.replace(',', '.'));
      return;
    }
    const parsed = Number(raw.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      onKgChange(raw);
      return;
    }
    if (parsed === 0 && allowEmpty) {
      onKgChange('');
      return;
    }
    onKgChange(formatWeight(roundKg(parsed)));
  }

  function handleLbsChange(raw: string) {
    editingLbs.current = true;
    setLbsDraft(raw);
    if (allowEmpty && raw.trim() === '') {
      onKgChange('');
      return;
    }
    const parsed = Number(raw.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    onKgChange(formatWeight(lbsToKg(Math.round(parsed))));
  }

  return (
    <View style={styles.field}>
      <Text numberOfLines={1} style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <TextInput
        value={kgValue}
        onChangeText={handleKgChange}
        onFocus={onFocus}
        style={[styles.fieldInput, { color: theme.text, borderColor: theme.border }]}
        keyboardType="decimal-pad"
        placeholder={placeholder ?? 'кг'}
        placeholderTextColor={theme.muted}
      />
      <Text style={[styles.unitHint, { color: theme.muted }]}>кг</Text>
      <TextInput
        value={lbsDraft}
        onChangeText={handleLbsChange}
        onFocus={() => {
          editingLbs.current = true;
          onFocus?.();
        }}
        onBlur={() => {
          editingLbs.current = false;
          setLbsDraft(lbsDisplay);
        }}
        editable={!(allowEmpty && kgValue.trim() === '')}
        style={[
          styles.fieldInput,
          { color: theme.text, borderColor: theme.border },
          allowEmpty && kgValue.trim() === '' && styles.disabled,
        ]}
        keyboardType="number-pad"
        placeholder="lbs"
        placeholderTextColor={theme.muted}
      />
      <Text style={[styles.unitHint, { color: theme.muted }]}>lbs</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  blockCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  blockLabel: {
    marginBottom: 8,
    fontSize: 20,
    fontWeight: '700',
  },
  blockInput: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
  },
  slot: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  variantLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  variant: {
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  move: {
    fontSize: 22,
    lineHeight: 28,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  weightRow: {
    marginTop: 8,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    height: 16,
    lineHeight: 16,
    marginBottom: 6,
    fontSize: 13,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 4,
  },
  unitHint: {
    fontSize: 11,
    marginBottom: 8,
  },
  bodyweightHint: {
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  remove: {
    fontSize: 28,
    lineHeight: 28,
    paddingHorizontal: 4,
  },
  addAlt: {
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    paddingVertical: 10,
    alignItems: 'center',
  },
  addAltLabel: {
    fontSize: 15,
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryLabel: {
    fontSize: 16,
  },
  primary: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    marginBottom: 8,
  },
});
