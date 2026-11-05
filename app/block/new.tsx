import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import {
  BlockForm,
  BlockFormActions,
  emptySlot,
  type BlockFormHandle,
  type DraftFields,
  type SlotDraft,
} from '../../components/BlockForm';
import { Screen } from '../../components/Screen';
import { createBlock, type ExerciseDraft } from '../../lib/db';
import { parsePositiveInt, parsePositiveNumber, roundKg } from '../../lib/format';

export default function NewBlockScreen() {
  const router = useRouter();
  const formRef = useRef<BlockFormHandle>(null);
  const [name, setName] = useState('');
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const drafts = parseDrafts(name, slots);
    if (typeof drafts === 'string') {
      setError(drafts);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const blockId = await createBlock(drafts.name, drafts.exercises);
      router.replace(`/block/${blockId}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить блок');
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={(
        <BlockFormActions
          error={error}
          saving={saving}
          saveLabel="Сохранить блок"
          onAdd={() => formRef.current?.addExercise()}
          onSave={handleSave}
        />
      )}
    >
      <Stack.Screen options={{ title: 'Новый блок' }} />
      <BlockForm
        ref={formRef}
        name={name}
        onNameChange={setName}
        slots={slots}
        onSlotsChange={setSlots}
      />
    </Screen>
  );
}

function parseVariant(exercise: DraftFields): ExerciseDraft | string {
  const exerciseName = exercise.name.trim();
  const sets = parsePositiveInt(exercise.sets);
  const reps = parsePositiveInt(exercise.reps);
  const bodyweight = exercise.startingWeight.trim() === '';
  const startingWeight = bodyweight ? 0 : parsePositiveNumber(exercise.startingWeight);
  const weightStep = bodyweight
    ? 0
    : parsePositiveNumber(exercise.weightStep);
  if (!exerciseName || sets === null || reps === null) {
    return 'У каждого упражнения нужны имя, подходы и повторения';
  }
  if (!bodyweight && (startingWeight === null || weightStep === null)) {
    return 'Для упражнений с весом нужны шаг и начальный вес больше нуля (или оставьте вес пустым для своего веса)';
  }
  return {
    id: exercise.id,
    name: exerciseName,
    sets,
    reps,
    weightStep: weightStep === null ? 0 : roundKg(weightStep),
    startingWeight: startingWeight === null ? 0 : roundKg(startingWeight),
    clientSlotKey: '',
  };
}

export function parseDrafts(
  name: string,
  slots: SlotDraft[],
): { name: string; exercises: ExerciseDraft[] } | string {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return 'Введите название блока';
  }
  if (slots.length === 0) {
    return 'Добавьте хотя бы одно упражнение';
  }
  const drafts: ExerciseDraft[] = [];
  for (const slot of slots) {
    if (slot.variants.length === 0) {
      return 'У каждого упражнения нужен хотя бы один вариант';
    }
    for (const variant of slot.variants) {
      const parsed = parseVariant(variant);
      if (typeof parsed === 'string') {
        return parsed;
      }
      drafts.push({
        ...parsed,
        slotId: slot.slotId,
        clientSlotKey: slot.clientKey,
      });
    }
  }
  return { name: trimmedName, exercises: drafts };
}
