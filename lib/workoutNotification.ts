import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  completeSession,
  getActiveSession,
  getSession,
  groupSessionSlots,
  setLineCompleted,
  type SessionDetails,
  type SessionLine,
} from './db';
import { formatWeightLabel } from './format';

const WORKOUT_NOTIFICATION_ID = 'active-workout';
const WORKOUT_CHANNEL_ID = 'workout';
const WORKOUT_CATEGORY_ID = 'workout';
const ACTION_DONE = 'done';
const ACTION_FINISH = 'finish';
export const WORKOUT_NOTIFICATION_TASK = 'WORKOUT-NOTIFICATION-TASK';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isAndroid(): boolean {
  return Platform.OS === 'android';
}

/** Sticky workout notifications need a custom/dev build — Expo Go crashes on channel APIs. */
function notificationsSupported(): boolean {
  if (!isAndroid()) {
    return false;
  }
  return Constants.appOwnership !== 'expo';
}

function currentWork(session: SessionDetails):
  | { kind: 'choice'; names: string[] }
  | { kind: 'exercise'; line: SessionLine }
  | null {
  for (const slot of groupSessionSlots(session.lines)) {
    const selected = slot.lines.find((line) => line.selected === true) ?? null;
    if (slot.lines.length > 1 && selected === null) {
      return { kind: 'choice', names: slot.lines.map((line) => line.name) };
    }
    const line = selected ?? slot.lines[0];
    if (line && line.completed === null) {
      return { kind: 'exercise', line };
    }
  }
  return null;
}

function lineBody(session: SessionDetails): string {
  const work = currentWork(session);
  if (!work) {
    return 'Все упражнения отмечены';
  }
  if (work.kind === 'choice') {
    return `Выберите: ${work.names.join(' / ')}`;
  }
  const line = work.line;
  const bodyweight = line.weightStep <= 0;
  const weight = bodyweight ? 0 : line.weight;
  return `${line.name} · ${formatWeightLabel(weight)} · ${line.sets}×${line.reps}`;
}

export async function ensureWorkoutNotificationsReady(): Promise<boolean> {
  if (!notificationsSupported()) {
    return false;
  }

  try {
    await Notifications.setNotificationChannelAsync(WORKOUT_CHANNEL_ID, {
      name: 'Тренировка',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0],
      enableVibrate: false,
      sound: null,
    });

    await Notifications.setNotificationCategoryAsync(WORKOUT_CATEGORY_ID, [
      {
        identifier: ACTION_DONE,
        buttonTitle: 'Сделал',
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_FINISH,
        buttonTitle: 'Завершить',
        options: { opensAppToForeground: false },
      },
    ]);

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function dismissWorkoutNotification(): Promise<void> {
  if (!notificationsSupported()) {
    return;
  }
  await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined);
}

export async function syncWorkoutNotification(session: SessionDetails | null): Promise<void> {
  if (!notificationsSupported()) {
    return;
  }

  try {
    const active = Boolean(session && session.status === 'planned' && session.startedAt !== null);
    if (!active || !session) {
      await dismissWorkoutNotification();
      return;
    }

    const granted = await ensureWorkoutNotificationsReady();
    if (!granted) {
      await dismissWorkoutNotification();
      return;
    }

    const work = currentWork(session);
    await Notifications.setNotificationCategoryAsync(
      WORKOUT_CATEGORY_ID,
      work?.kind === 'exercise'
        ? [{
            identifier: ACTION_DONE,
            buttonTitle: 'Сделал',
            options: { opensAppToForeground: false },
          }]
        : work?.kind === 'choice'
          ? []
          : [{
              identifier: ACTION_FINISH,
              buttonTitle: 'Завершить',
              options: { opensAppToForeground: false },
            }],
    );

    await Notifications.scheduleNotificationAsync({
      identifier: WORKOUT_NOTIFICATION_ID,
      content: {
        title: session.blockName,
        body: lineBody(session),
        sticky: true,
        autoDismiss: false,
        categoryIdentifier: WORKOUT_CATEGORY_ID,
        data: {
          sessionId: session.id,
          url: `/session/${session.id}`,
        },
        sound: false,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        channelId: WORKOUT_CHANNEL_ID,
      },
    });
  } catch {
    // Native notification APIs may be unavailable outside a custom build.
  }
}

export async function syncActiveWorkoutNotification(): Promise<void> {
  if (!notificationsSupported()) {
    return;
  }
  try {
    const active = await getActiveSession();
    if (!active) {
      await dismissWorkoutNotification();
      return;
    }
    const session = await getSession(active.id);
    await syncWorkoutNotification(session);
  } catch {
    // Ignore — training UI still works without lock-screen notification.
  }
}

let responseInFlight = false;

export async function handleWorkoutNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<string | null> {
  if (!notificationsSupported() || responseInFlight) {
    return null;
  }
  responseInFlight = true;

  try {
    return await handleWorkoutNotificationResponseInner(response);
  } finally {
    responseInFlight = false;
  }
}

async function handleWorkoutNotificationResponseInner(
  response: Notifications.NotificationResponse,
): Promise<string | null> {
  const data = response.notification.request.content.data;
  const rawSessionId = data?.sessionId;
  const sessionId = typeof rawSessionId === 'number'
    ? rawSessionId
    : typeof rawSessionId === 'string'
      ? Number(rawSessionId)
      : NaN;
  if (!Number.isFinite(sessionId)) {
    return null;
  }

  const action = response.actionIdentifier;

  if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return `/session/${sessionId}`;
  }

  if (action === ACTION_DONE) {
    const session = await getSession(sessionId);
    if (!session || session.status !== 'planned') {
      await dismissWorkoutNotification();
      return null;
    }
    const work = currentWork(session);
    if (work?.kind === 'exercise') {
      await setLineCompleted(work.line.id, true, null);
    }
    const next = await getSession(sessionId);
    await syncWorkoutNotification(next);
    return null;
  }

  if (action === ACTION_FINISH) {
    await completeSession(sessionId);
    await dismissWorkoutNotification();
    return '/';
  }

  return null;
}

TaskManager.defineTask(WORKOUT_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data || typeof data !== 'object') {
    return;
  }
  if (!('actionIdentifier' in data)) {
    return;
  }
  await handleWorkoutNotificationResponse(data as Notifications.NotificationResponse);
});

export async function registerWorkoutNotificationTask(): Promise<void> {
  if (!notificationsSupported()) {
    return;
  }
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(WORKOUT_NOTIFICATION_TASK);
    if (!registered) {
      await Notifications.registerTaskAsync(WORKOUT_NOTIFICATION_TASK);
    }
  } catch {
    // Background task registration is optional in Expo Go / unsupported builds.
  }
}
