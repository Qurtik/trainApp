import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';

import {
  BlockForm,
  BlockFormActions,
  type BlockFormHandle,
  type SlotDraft,
} from '../../../components/BlockForm';
import { Screen } from '../../../components/Screen';
import { useTheme } from '../../../components/Theme';
import { getBlock, updateBlock } from '../../../lib/db';
import { formatWeight, isBodyweight } from '../../../lib/format';
import { goBackOrReplace } from '../../../lib/navigation';
import { parseDrafts } from '../new';

export default function EditBlockScreen() {
  const router = useRouter();
  const formRef = useRef<BlockFormHandle>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const blockId = Number(id);
  const [name, setName] = useState('');
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    getBlock(blockId)
      .then((block) => {
        if (!block) {
          setError('Блок не найден');
          return;
        }
        setName(block.name);
        setSlots(block.slots.map((slot) => ({
          clientKey: `slot-${slot.slotId}`,
          slotId: slot.slotId,
          variants: slot.variants.map((exercise) => ({
            id: exercise.id,
            clientKey: String(exercise.id),
            name: exercise.name,
            sets: String(exercise.sets),
            reps: String(exercise.reps),
            weightStep: exercise.weightStep > 0 ? formatWeight(exercise.weightStep) : '2.5',
            startingWeight: isBodyweight(exercise.startingWeight) ? '' : formatWeight(exercise.startingWeight),
          })),
        })));
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Не удалось открыть блок');
      })
      .finally(() => setLoading(false));
  }, [blockId]);

  async function handleSave() {
    const drafts = parseDrafts(name, slots);
    if (typeof drafts === 'string') {
      setError(drafts);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateBlock(blockId, drafts.name, drafts.exercises);
      goBackOrReplace(router, `/block/${blockId}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить блок');
      setSaving(false);
    }
  }

  const notFound = slots.length === 0 && error;

  return (
    <Screen
      loading={loading}
      footer={notFound ? undefined : (
        <BlockFormActions
          error={error}
          saving={saving}
          saveLabel="Сохранить"
          onAdd={() => formRef.current?.addExercise()}
          onSave={handleSave}
        />
      )}
    >
      <Stack.Screen options={{ title: 'Редактирование' }} />
      {notFound ? (
        <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
      ) : (
        <BlockForm
          ref={formRef}
          name={name}
          onNameChange={setName}
          slots={slots}
          onSlotsChange={setSlots}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {},
});
