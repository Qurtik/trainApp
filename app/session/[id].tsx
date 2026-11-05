import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/Theme';
import {
  chooseSessionAlternative,
  completeSession,
  getSession,
  groupSessionSlots,
  reorderSessionExercises,
  setLineCompleted,
  setLineWeight,
  type SessionDetails,
  type SessionLine,
  type SessionSlot,
} from '../../lib/db';
import { formatDuration, formatWeight, formatWeightLabel, shiftWeight } from '../../lib/format';
import { dismissWorkoutNotification, syncWorkoutNotification } from '../../lib/workoutNotification';

const reorderTransition = LinearTransition.duration(250);

export default function SessionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pendingLineId, setPendingLineId] = useState<number | null>(null);
  const [pendingComment, setPendingComment] = useState('');
  const { theme } = useTheme();

  const slots = useMemo(
    () => (session ? groupSessionSlots(session.lines) : []),
    [session],
  );

  const load = useCallback(async () => {
    const next = await getSession(sessionId);
    setSession(next);
    await syncWorkoutNotification(next);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть тренировку');
        })
        .finally(() => setLoading(false));
    }, [load]),
  );

  const running = session?.status === 'planned' && session.startedAt !== null;
  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  async function changeWeight(lineId: number, current: number, step: number) {
    if (!session || session.status !== 'planned' || saving) {
      return;
    }
    const nextWeight = shiftWeight(current, step);
    setSession({
      ...session,
      lines: session.lines.map((line) => (line.id === lineId ? { ...line, weight: nextWeight } : line)),
    });
    try {
      await setLineWeight(lineId, nextWeight);
      const next = await getSession(sessionId);
      setSession(next);
      await syncWorkoutNotification(next);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось изменить вес');
      await load();
    }
  }

  function openMark(lineId: number, comment: string | null) {
    setPendingComment(comment ?? '');
    setPendingLineId(lineId);
  }

  async function changeCompleted(lineId: number, completed: boolean) {
    if (!session || session.status !== 'planned' || saving) {
      return;
    }
    const comment = pendingComment.trim();
    setPendingLineId(null);
    setSession({
      ...session,
      lines: session.lines.map((line) => (
        line.id === lineId ? { ...line, completed, comment: comment.length > 0 ? comment : null } : line
      )),
    });
    try {
      await setLineCompleted(lineId, completed, comment);
      const next = await getSession(sessionId);
      setSession(next);
      await syncWorkoutNotification(next);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить отметку');
      await load();
    }
  }

  async function chooseAlternative(slotId: number, lineId: number) {
    if (!session || session.status !== 'planned' || saving) {
      return;
    }
    setSession({
      ...session,
      lines: session.lines.map((line) => (
        line.slotId !== slotId
          ? line
          : { ...line, selected: line.id === lineId }
      )),
    });
    try {
      await chooseSessionAlternative(sessionId, slotId, lineId);
      const next = await getSession(sessionId);
      setSession(next);
      await syncWorkoutNotification(next);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выбрать упражнение');
      await load();
    }
  }

  async function moveSlot(index: number, direction: -1 | 1) {
    if (!session || session.status !== 'planned' || saving) {
      return;
    }
    const target = index + direction;
    if (target < 0 || target >= slots.length) {
      return;
    }
    const nextSlots = [...slots];
    const item = nextSlots[index];
    nextSlots[index] = nextSlots[target];
    nextSlots[target] = item;
    const nextLines = nextSlots.flatMap((slot) => slot.lines);
    setSession({ ...session, lines: nextLines });
    try {
      await reorderSessionExercises(session.id, nextSlots.map((slot) => slot.slotId));
      await syncWorkoutNotification({ ...session, lines: nextLines });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось изменить порядок');
      await load();
    }
  }

  async function handleComplete() {
    if (!session || session.status !== 'planned' || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeSession(session.id);
      await dismissWorkoutNotification();
      router.replace('/');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось завершить тренировку');
      setSaving(false);
    }
  }

  const readOnly = session?.status === 'done';
  const duration = session?.startedAt
    ? formatDuration(
      session.startedAt,
      session.finishedAt ? new Date(session.finishedAt).getTime() : now,
    )
    : null;

  return (
    <>
    <Screen loading={loading}>
      <Stack.Screen options={{ title: session ? `${session.blockName}, ${session.plannedDate}` : 'Тренировка' }} />
      {duration ? <Text style={[styles.timer, { color: theme.text }]}>{duration}</Text> : null}
      {slots.map((slot, index) => (
        <SlotBlock
          key={slot.slotId}
          slot={slot}
          index={index}
          total={slots.length}
          readOnly={Boolean(readOnly)}
          onMoveUp={() => moveSlot(index, -1)}
          onMoveDown={() => moveSlot(index, 1)}
          onChoose={(lineId) => chooseAlternative(slot.slotId, lineId)}
          onChangeWeight={changeWeight}
          onOpenMark={openMark}
        />
      ))}
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {session && !readOnly ? (
        <Pressable style={[styles.primary, { backgroundColor: theme.accent }, saving && styles.disabled]} disabled={saving} onPress={handleComplete}>
          <Text style={[styles.primaryLabel, { color: theme.accentText }]}>{saving ? 'Сохранение...' : 'Завершить тренировку'}</Text>
        </Pressable>
      ) : null}
    </Screen>
    <Modal
      visible={pendingLineId !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setPendingLineId(null)}
    >
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: theme.background }]}>
          <View style={styles.dialogHeader}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Успешно?</Text>
            <Pressable
              hitSlop={8}
              accessibilityLabel="Очистить комментарий"
              onPress={() => setPendingComment('')}
            >
              <Text style={[styles.clearLabel, { color: theme.muted }]}>Очистить</Text>
            </Pressable>
          </View>
          <TextInput
            value={pendingComment}
            onChangeText={setPendingComment}
            style={[styles.comment, { color: theme.text, borderColor: theme.border }]}
            placeholder="Комментарий"
            placeholderTextColor={theme.muted}
            multiline
          />
          <View style={styles.dialogActions}>
            <Pressable
              style={[styles.dialogButton, { borderColor: theme.accent }]}
              onPress={() => pendingLineId !== null && changeCompleted(pendingLineId, true)}
            >
              <Text style={[styles.dialogButtonLabel, { color: theme.text }]}>Да</Text>
            </Pressable>
            <Pressable
              style={[styles.dialogButton, { borderColor: theme.accent }]}
              onPress={() => pendingLineId !== null && changeCompleted(pendingLineId, false)}
            >
              <Text style={[styles.dialogButtonLabel, { color: theme.text }]}>Нет</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

function SlotBlock({
  slot,
  index,
  total,
  readOnly,
  onMoveUp,
  onMoveDown,
  onChoose,
  onChangeWeight,
  onOpenMark,
}: {
  slot: SessionSlot;
  index: number;
  total: number;
  readOnly: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChoose: (lineId: number) => void;
  onChangeWeight: (lineId: number, current: number, step: number) => void;
  onOpenMark: (lineId: number, comment: string | null) => void;
}) {
  const { theme } = useTheme();
  const selectedLine = slot.lines.find((line) => line.selected === true) ?? null;
  const canReselect = !readOnly
    && slot.lines.length > 1
    && selectedLine !== null
    && selectedLine.completed === null;
  const [changing, setChanging] = useState(false);
  const showChoice = !readOnly
    && slot.lines.length > 1
    && (selectedLine === null || (changing && selectedLine.completed === null));

  const reorderControls = readOnly ? null : (
    <View style={styles.actions}>
      <Pressable
        hitSlop={10}
        accessibilityLabel="Переместить вверх"
        disabled={index === 0}
        onPress={onMoveUp}
      >
        <Text style={[styles.move, { color: index === 0 ? theme.border : theme.text }]}>↑</Text>
      </Pressable>
      <Pressable
        hitSlop={10}
        accessibilityLabel="Переместить вниз"
        disabled={index === total - 1}
        onPress={onMoveDown}
      >
        <Text style={[styles.move, { color: index === total - 1 ? theme.border : theme.text }]}>↓</Text>
      </Pressable>
    </View>
  );

  if (showChoice) {
    return (
      <Animated.View
        layout={reorderTransition}
        style={[styles.choiceCard, { borderColor: theme.accent }]}
      >
        <View style={styles.choiceHeader}>
          <Text style={[styles.choiceTitle, { color: theme.text }]}>Выберите упражнение</Text>
          {reorderControls}
        </View>
        {slot.lines.map((line) => (
          <Pressable
            key={line.id}
            style={[
              styles.choiceOption,
              { borderColor: line.selected === true ? theme.accent : theme.border },
            ]}
            onPress={() => {
              setChanging(false);
              onChoose(line.id);
            }}
          >
            <ChoicePreview line={line} />
          </Pressable>
        ))}
        {changing ? (
          <Pressable style={styles.changeCancel} onPress={() => setChanging(false)}>
            <Text style={[styles.changeCancelLabel, { color: theme.muted }]}>Отмена</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  const line = selectedLine ?? slot.lines[0];
  if (!line) {
    return null;
  }

  return (
    <ExerciseLine
      line={line}
      readOnly={readOnly}
      canChange={canReselect}
      onChange={() => setChanging(true)}
      reorderControls={reorderControls}
      onChangeWeight={onChangeWeight}
      onOpenMark={onOpenMark}
    />
  );
}

function ChoicePreview({ line }: { line: SessionLine }) {
  const { theme } = useTheme();
  const bodyweight = line.weightStep <= 0;
  const weight = bodyweight ? 0 : (line.weight ?? line.previousWeight ?? 0);
  const previousMark = !line.hasPrevious
    ? 'Первый раз'
    : line.previousCompleted
      ? 'В прошлый раз получилось'
      : line.previousCompleted === false
        ? 'В прошлый раз не получилось'
        : 'В прошлый раз отметки не было';
  return (
    <>
      <Text style={[styles.name, { color: theme.text }]}>{line.name}</Text>
      <Text style={[styles.meta, { color: theme.muted }]}>
        {bodyweight
          ? `${line.sets}×${line.reps}`
          : `${line.sets}×${line.reps}, ${formatWeightLabel(weight)}`}
      </Text>
      <Text style={[styles.meta, { color: theme.muted }]}>{previousMark}</Text>
    </>
  );
}

function ExerciseLine({
  line,
  readOnly,
  canChange,
  onChange,
  reorderControls,
  onChangeWeight,
  onOpenMark,
}: {
  line: SessionLine;
  readOnly: boolean;
  canChange?: boolean;
  onChange?: () => void;
  reorderControls: ReactNode;
  onChangeWeight: (lineId: number, current: number, step: number) => void;
  onOpenMark: (lineId: number, comment: string | null) => void;
}) {
  const { theme } = useTheme();
  const bodyweight = line.weightStep <= 0;
  const weight = bodyweight ? 0 : (line.weight ?? 0);
  const stepLabel = formatWeight(line.weightStep);
  const resultLabel = line.completed ? 'Получилось' : 'Не получилось';

  if (line.completed !== null) {
    return (
      <Animated.View
        layout={reorderTransition}
        style={[styles.doneRow, { backgroundColor: line.completed ? theme.success : theme.fail }]}
      >
        <Pressable
          style={styles.doneBody}
          disabled={readOnly}
          onPress={() => onOpenMark(line.id, line.comment)}
        >
          <Text style={[styles.doneText, { color: theme.text }]}>
            {line.name} · {line.sets}×{line.reps} · {formatWeightLabel(weight)} · {resultLabel}
          </Text>
          {line.comment ? <Text style={[styles.doneComment, { color: theme.muted }]}>{line.comment}</Text> : null}
        </Pressable>
        {reorderControls}
      </Animated.View>
    );
  }

  const previousMark = !line.hasPrevious
    ? 'Первый раз'
    : line.previousCompleted
      ? 'В прошлый раз получилось'
      : line.previousCompleted === false
        ? 'В прошлый раз не получилось'
        : 'В прошлый раз отметки не было';

  return (
    <Animated.View
      layout={reorderTransition}
      style={[styles.lineRow, { borderTopColor: theme.border }]}
    >
      <View style={styles.lineBody}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.text, flex: 1 }]}>{line.name}</Text>
          {canChange ? (
            <Pressable hitSlop={8} onPress={onChange}>
              <Text style={[styles.changeLabel, { color: theme.accent }]}>Сменить</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.meta, { color: theme.muted }]}>
          {bodyweight
            ? `${line.sets}×${line.reps}`
            : `${line.sets}×${line.reps}, шаг ${formatWeightLabel(line.weightStep)}`}
        </Text>
        {bodyweight ? null : (
          <Text style={[styles.meta, { color: theme.muted }]}>
            Прошлый вес: {line.previousWeight === null ? 'нет' : formatWeightLabel(line.previousWeight)}
          </Text>
        )}
        <Text style={[styles.meta, { color: theme.muted }]}>{previousMark}</Text>
        {line.previousComment ? (
          <Text style={[styles.previousComment, { color: theme.muted }]}>
            Предыдущий комментарий: {line.previousComment}
          </Text>
        ) : null}
        {bodyweight ? (
          <Text style={[styles.weight, { color: theme.text }]}>{formatWeightLabel(0)}</Text>
        ) : (
          <View style={styles.weightRow}>
            {readOnly ? null : (
              <Pressable style={[styles.step, { borderColor: theme.accent }]} onPress={() => onChangeWeight(line.id, weight, -line.weightStep)}>
                <Text style={[styles.stepLabel, { color: theme.text }]}>− {stepLabel}</Text>
              </Pressable>
            )}
            <Text style={[styles.weight, { color: theme.text }]}>{formatWeightLabel(weight)}</Text>
            {readOnly ? null : (
              <Pressable style={[styles.step, { borderColor: theme.accent }]} onPress={() => onChangeWeight(line.id, weight, line.weightStep)}>
                <Text style={[styles.stepLabel, { color: theme.text }]}>+ {stepLabel}</Text>
              </Pressable>
            )}
          </View>
        )}
        {readOnly ? null : (
          <Pressable
            style={[styles.doneButton, { backgroundColor: theme.accent }]}
            onPress={() => onOpenMark(line.id, line.comment ?? line.previousComment)}
          >
            <Text style={[styles.doneButtonLabel, { color: theme.accentText }]}>Сделал</Text>
          </Pressable>
        )}
      </View>
      {reorderControls}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },
  choiceCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  choiceTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  choiceOption: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  changeCancel: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  changeCancelLabel: {
    fontSize: 15,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    gap: 8,
  },
  lineBody: {
    flex: 1,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
    gap: 8,
  },
  doneBody: {
    flex: 1,
  },
  doneText: {
    fontSize: 16,
  },
  doneComment: {
    marginTop: 4,
    fontSize: 14,
  },
  name: {
    fontSize: 17,
  },
  meta: {
    marginTop: 4,
  },
  previousComment: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
  },
  weightRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weight: {
    fontSize: 20,
    fontWeight: '600',
    minWidth: 88,
    textAlign: 'center',
  },
  step: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stepLabel: {
    fontSize: 15,
  },
  doneButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  doneButtonLabel: {
    fontSize: 16,
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    borderRadius: 12,
    padding: 20,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  comment: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  dialogTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
  },
  clearLabel: {
    fontSize: 15,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dialogButtonLabel: {
    fontSize: 16,
  },
  primary: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryLabel: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    marginTop: 8,
  },
});
