import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/Theme';
import {
  getBlockPreview,
  getSession,
  reorderBlockExercises,
  startWorkout,
  type PreviewSlot,
} from '../../lib/db';
import { formatWeightLabel, isBodyweight } from '../../lib/format';
import { syncWorkoutNotification } from '../../lib/workoutNotification';

const reorderTransition = LinearTransition.duration(250);

export default function StartPreviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const blockId = Number(id);
  const [slots, setSlots] = useState<PreviewSlot[]>([]);
  const [blockName, setBlockName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useFocusEffect(
    useCallback(() => {
      getBlockPreview(blockId)
        .then((preview) => {
          if (!preview) {
            setError('Блок не найден');
            setSlots([]);
            setBlockName(null);
            return;
          }
          setBlockName(preview.name);
          setSlots(preview.slots);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть блок');
        })
        .finally(() => setLoading(false));
    }, [blockId]),
  );

  function moveSlot(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slots.length) {
      return;
    }
    setSlots((current) => {
      const next = [...current];
      const item = next[index];
      next[index] = next[target];
      next[target] = item;
      return next;
    });
  }

  async function handleStart() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reorderBlockExercises(blockId, slots.map((slot) => slot.slotId));
      const sessionId = await startWorkout(blockId);
      const session = await getSession(sessionId);
      await syncWorkoutNotification(session);
      router.replace(`/session/${sessionId}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось начать тренировку');
      setBusy(false);
    }
  }

  return (
    <Screen loading={loading}>
      <Stack.Screen options={{ title: blockName ?? 'Подготовка' }} />
      {slots.map((slot, index) => (
        <Animated.View
          key={slot.slotId}
          layout={reorderTransition}
          style={[styles.row, { borderTopColor: theme.border }]}
        >
          <View style={styles.lineBody}>
            {slot.variants.map((line, variantIndex) => {
              const weight = line.previousWeight ?? line.startingWeight;
              const weightLabel = isBodyweight(line.startingWeight) && line.previousWeight === null
                ? 'Вес'
                : line.previousWeight === null
                  ? 'Начальный вес'
                  : 'Прошлый вес';
              const mark = line.previousWeight === null && line.previousCompleted === null
                ? 'Первый раз'
                : line.previousCompleted
                  ? 'В прошлый раз получилось'
                  : line.previousCompleted === false
                    ? 'В прошлый раз не получилось'
                    : 'В прошлый раз отметки не было';
              return (
                <View key={line.exerciseId} style={variantIndex > 0 ? styles.altBlock : undefined}>
                  {variantIndex > 0 ? (
                    <Text style={[styles.orLabel, { color: theme.muted }]}>или</Text>
                  ) : null}
                  <Text style={[styles.line, { color: theme.text }]}>
                    {line.name}: {line.sets}×{line.reps}{'\n'}
                    {weightLabel}: {formatWeightLabel(weight)}{'\n'}
                    {mark}
                  </Text>
                  {line.previousComment ? (
                    <Text style={[styles.previousComment, { color: theme.muted }]}>
                      Предыдущий комментарий: {line.previousComment}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {slot.variants.length > 1 ? (
              <Text style={[styles.hint, { color: theme.muted }]}>
                Выбор альтернативы — во время тренировки
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Pressable
              hitSlop={10}
              accessibilityLabel="Переместить вверх"
              disabled={index === 0}
              onPress={() => moveSlot(index, -1)}
            >
              <Text style={[styles.move, { color: index === 0 ? theme.border : theme.text }]}>↑</Text>
            </Pressable>
            <Pressable
              hitSlop={10}
              accessibilityLabel="Переместить вниз"
              disabled={index === slots.length - 1}
              onPress={() => moveSlot(index, 1)}
            >
              <Text style={[styles.move, { color: index === slots.length - 1 ? theme.border : theme.text }]}>↓</Text>
            </Pressable>
          </View>
        </Animated.View>
      ))}
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      <Pressable style={[styles.primary, { backgroundColor: theme.accent }, busy && styles.disabled]} disabled={busy} onPress={handleStart}>
        <Text style={[styles.primaryLabel, { color: theme.accentText }]}>{busy ? 'Старт...' : 'Начать'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginBottom: 4,
    gap: 8,
  },
  lineBody: {
    flex: 1,
  },
  line: {
    fontSize: 16,
    lineHeight: 22,
  },
  altBlock: {
    marginTop: 8,
  },
  orLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
  },
  previousComment: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  move: {
    fontSize: 22,
    lineHeight: 28,
    paddingHorizontal: 6,
  },
  primary: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
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
