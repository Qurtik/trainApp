import * as SQLite from 'expo-sqlite';

import { defaultThemeChoice, isHexColor, presets, type Palette, type ThemeChoice, type ThemePreset } from './theme';

export type ExerciseDraft = {
  id?: number;
  slotId?: number;
  clientSlotKey: string;
  name: string;
  sets: number;
  reps: number;
  weightStep: number;
  startingWeight: number;
};

export type BlockSummary = {
  id: number;
  name: string;
  exerciseCount: number;
};

export type Exercise = {
  id: number;
  slotId: number;
  name: string;
  sets: number;
  reps: number;
  weightStep: number;
  startingWeight: number;
};

export type ExerciseSlot = {
  slotId: number;
  variants: Exercise[];
};

export type BlockDetails = {
  id: number;
  name: string;
  slots: ExerciseSlot[];
};

export type SessionStatus = 'planned' | 'done';

export type SessionSummary = {
  id: number;
  blockId: number;
  blockName: string;
  plannedDate: string;
  status: SessionStatus;
};

export type PreviewLine = {
  exerciseId: number;
  name: string;
  sets: number;
  reps: number;
  weightStep: number;
  startingWeight: number;
  previousWeight: number | null;
  previousCompleted: boolean | null;
  previousComment: string | null;
};

export type PreviewSlot = {
  slotId: number;
  variants: PreviewLine[];
};

export type BlockPreview = {
  id: number;
  name: string;
  slots: PreviewSlot[];
};

export type SessionLine = {
  id: number;
  slotId: number;
  name: string;
  sets: number;
  reps: number;
  weightStep: number;
  weight: number | null;
  completed: boolean | null;
  comment: string | null;
  selected: boolean | null;
  previousWeight: number | null;
  previousCompleted: boolean | null;
  previousComment: string | null;
  hasPrevious: boolean;
};

export type SessionSlot = {
  slotId: number;
  lines: SessionLine[];
};

export type SessionDetails = {
  id: number;
  blockId: number;
  blockName: string;
  plannedDate: string;
  status: SessionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  lines: SessionLine[];
};

export type LatestSuccessfulWeight = {
  exerciseId: number;
  name: string;
  blockName: string;
  weight: number | null;
  weightStep: number;
  sets: number;
  reps: number;
  succeededAt: string | null;
};

type ExerciseRow = {
  id: number;
  slot_id: number;
  name: string;
  sets: number;
  reps: number;
  weight_step: number;
  starting_weight: number;
  sort_order: number;
  alt_order: number;
};

type SessionRow = {
  id: number;
  block_id: number;
  block_name: string;
  planned_date: string;
  status: SessionStatus;
  started_at: string | null;
  finished_at: string | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('train.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS blocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          block_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          sets INTEGER NOT NULL,
          reps INTEGER NOT NULL,
          weight_step REAL NOT NULL,
          sort_order INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          block_id INTEGER NOT NULL,
          planned_date TEXT NOT NULL,
          status TEXT NOT NULL,
          completed_all INTEGER
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS session_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          exercise_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          sets INTEGER NOT NULL,
          reps INTEGER NOT NULL,
          weight_step REAL NOT NULL,
          weight REAL,
          sort_order INTEGER NOT NULL
        );
      `);
      await ensureColumn(db, 'exercises', 'starting_weight', 'starting_weight REAL NOT NULL DEFAULT 0');
      await ensureColumn(db, 'sessions', 'started_at', 'started_at TEXT');
      await ensureColumn(db, 'sessions', 'finished_at', 'finished_at TEXT');
      await ensureColumn(db, 'session_exercises', 'completed', 'completed INTEGER');
      await ensureColumn(db, 'session_exercises', 'comment', 'comment TEXT');
      await ensureColumn(db, 'exercises', 'slot_id', 'slot_id INTEGER');
      await ensureColumn(db, 'exercises', 'alt_order', 'alt_order INTEGER NOT NULL DEFAULT 0');
      await ensureColumn(db, 'session_exercises', 'slot_id', 'slot_id INTEGER');
      await ensureColumn(db, 'session_exercises', 'selected', 'selected INTEGER');
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) < 1) {
        await db.execAsync(`
          UPDATE session_exercises
          SET completed = NULL
          WHERE completed = 0
            AND session_id IN (SELECT id FROM sessions WHERE status = 'planned');
          PRAGMA user_version = 1;
        `);
      }
      const nextVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((nextVersion?.user_version ?? 0) < 2) {
        await db.execAsync(`
          UPDATE exercises SET slot_id = id WHERE slot_id IS NULL;
          UPDATE exercises SET alt_order = 0 WHERE alt_order IS NULL;
          UPDATE session_exercises
          SET slot_id = COALESCE(
            (SELECT e.slot_id FROM exercises e WHERE e.id = session_exercises.exercise_id),
            exercise_id
          )
          WHERE slot_id IS NULL;
          PRAGMA user_version = 2;
        `);
      }
      const selectedVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((selectedVersion?.user_version ?? 0) < 3) {
        await db.execAsync(`
          UPDATE session_exercises SET selected = 1 WHERE selected IS NULL;
          PRAGMA user_version = 3;
        `);
      }
      return db;
    });
  }
  return databasePromise;
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

export async function loadThemeChoice(): Promise<ThemeChoice> {
  const fallback = defaultThemeChoice();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    'theme',
  );
  if (!row) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(row.value) as {
      preset?: string;
      custom?: unknown;
      customGradient?: unknown;
    };
    const rawPreset = parsed.preset === 'gradient' ? 'gradientTeal' : parsed.preset;
    const preset = isThemePreset(rawPreset) || rawPreset === 'custom' ? rawPreset : 'light';
    const custom = isPalette(parsed.custom) ? parsed.custom : fallback.custom;
    const customGradient = isGradientPair(parsed.customGradient) ? parsed.customGradient : null;
    return { preset, custom, customGradient };
  } catch {
    return fallback;
  }
}

export async function saveThemeChoice(choice: ThemeChoice): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES ('theme', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    JSON.stringify(choice),
  );
}

function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === 'string' && value in presets;
}

function isPalette(value: unknown): value is Palette {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const palette = value as Palette;
  return isHexColor(palette.background)
    && isHexColor(palette.text)
    && isHexColor(palette.accent)
    && isHexColor(palette.success)
    && isHexColor(palette.fail);
}

function isGradientPair(value: unknown): value is readonly [string, string] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'string'
    && typeof value[1] === 'string'
    && isHexColor(value[0])
    && isHexColor(value[1]);
}

export function todayDate(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function groupSessionSlots(lines: SessionLine[]): SessionSlot[] {
  const order: number[] = [];
  const bySlot = new Map<number, SessionLine[]>();
  for (const line of lines) {
    if (!bySlot.has(line.slotId)) {
      order.push(line.slotId);
      bySlot.set(line.slotId, []);
    }
    bySlot.get(line.slotId)!.push(line);
  }
  return order.map((slotId) => ({
    slotId,
    lines: bySlot.get(slotId)!,
  }));
}

function groupExercisesIntoSlots(exercises: Exercise[]): ExerciseSlot[] {
  const order: number[] = [];
  const bySlot = new Map<number, Exercise[]>();
  for (const exercise of exercises) {
    if (!bySlot.has(exercise.slotId)) {
      order.push(exercise.slotId);
      bySlot.set(exercise.slotId, []);
    }
    bySlot.get(exercise.slotId)!.push(exercise);
  }
  return order.map((slotId) => ({
    slotId,
    variants: bySlot.get(slotId)!,
  }));
}

function groupDraftsBySlot(exercises: ExerciseDraft[]): ExerciseDraft[][] {
  const order: string[] = [];
  const byKey = new Map<string, ExerciseDraft[]>();
  for (const exercise of exercises) {
    if (!byKey.has(exercise.clientSlotKey)) {
      order.push(exercise.clientSlotKey);
      byKey.set(exercise.clientSlotKey, []);
    }
    byKey.get(exercise.clientSlotKey)!.push(exercise);
  }
  return order.map((key) => byKey.get(key)!);
}

export async function listBlocks(): Promise<BlockSummary[]> {
  const db = await getDatabase();
  return db.getAllAsync<BlockSummary>(`
    SELECT b.id, b.name, COUNT(DISTINCT e.slot_id) AS exerciseCount
    FROM blocks b
    LEFT JOIN exercises e ON e.block_id = b.id
    GROUP BY b.id
    ORDER BY b.name, b.id
  `);
}

export async function createBlock(name: string, exercises: ExerciseDraft[]): Promise<number> {
  const db = await getDatabase();
  let blockId = 0;
  const slots = groupDraftsBySlot(exercises);
  if (slots.length === 0) {
    throw new Error('В блоке нет упражнений');
  }
  await db.withTransactionAsync(async () => {
    const created = await db.runAsync('INSERT INTO blocks (name) VALUES (?)', name.trim());
    blockId = created.lastInsertRowId;
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const variants = slots[slotIndex];
      let slotId = 0;
      for (let altIndex = 0; altIndex < variants.length; altIndex += 1) {
        const exercise = variants[altIndex];
        const inserted = await db.runAsync(
          `INSERT INTO exercises
            (block_id, name, sets, reps, weight_step, starting_weight, sort_order, slot_id, alt_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          blockId,
          exercise.name.trim(),
          exercise.sets,
          exercise.reps,
          exercise.weightStep,
          exercise.startingWeight,
          slotIndex,
          altIndex === 0 ? 0 : slotId,
          altIndex,
        );
        if (altIndex === 0) {
          slotId = inserted.lastInsertRowId;
          await db.runAsync('UPDATE exercises SET slot_id = ? WHERE id = ?', slotId, slotId);
        }
      }
    }
  });
  return blockId;
}

export async function reorderBlockExercises(blockId: number, slotIds: number[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < slotIds.length; index += 1) {
      await db.runAsync(
        'UPDATE exercises SET sort_order = ? WHERE slot_id = ? AND block_id = ?',
        index,
        slotIds[index],
        blockId,
      );
    }
  });
}

export async function reorderSessionExercises(sessionId: number, slotIds: number[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < slotIds.length; index += 1) {
      await db.runAsync(
        'UPDATE session_exercises SET sort_order = ? WHERE slot_id = ? AND session_id = ?',
        index,
        slotIds[index],
        sessionId,
      );
    }
  });
}

export async function updateBlock(blockId: number, name: string, exercises: ExerciseDraft[]): Promise<void> {
  const db = await getDatabase();
  const slots = groupDraftsBySlot(exercises);
  if (slots.length === 0) {
    throw new Error('В блоке нет упражнений');
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE blocks SET name = ? WHERE id = ?', name.trim(), blockId);
    const existing = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM exercises WHERE block_id = ?',
      blockId,
    );
    const kept = new Set(
      exercises.flatMap((exercise) => (exercise.id === undefined ? [] : [exercise.id])),
    );
    for (const row of existing) {
      if (!kept.has(row.id)) {
        await db.runAsync('DELETE FROM exercises WHERE id = ? AND block_id = ?', row.id, blockId);
      }
    }
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const variants = slots[slotIndex];
      let slotId = variants.find((item) => item.slotId !== undefined)?.slotId ?? 0;
      for (let altIndex = 0; altIndex < variants.length; altIndex += 1) {
        const exercise = variants[altIndex];
        if (exercise.id === undefined) {
          const inserted = await db.runAsync(
            `INSERT INTO exercises
              (block_id, name, sets, reps, weight_step, starting_weight, sort_order, slot_id, alt_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            blockId,
            exercise.name.trim(),
            exercise.sets,
            exercise.reps,
            exercise.weightStep,
            exercise.startingWeight,
            slotIndex,
            slotId || 0,
            altIndex,
          );
          if (!slotId) {
            slotId = inserted.lastInsertRowId;
            await db.runAsync('UPDATE exercises SET slot_id = ? WHERE id = ?', slotId, slotId);
          } else {
            await db.runAsync(
              'UPDATE exercises SET slot_id = ? WHERE id = ? AND block_id = ?',
              slotId,
              inserted.lastInsertRowId,
              blockId,
            );
          }
        } else {
          if (!slotId) {
            slotId = exercise.slotId ?? exercise.id;
          }
          await db.runAsync(
            `UPDATE exercises
             SET name = ?, sets = ?, reps = ?, weight_step = ?, starting_weight = ?,
                 sort_order = ?, slot_id = ?, alt_order = ?
             WHERE id = ? AND block_id = ?`,
            exercise.name.trim(),
            exercise.sets,
            exercise.reps,
            exercise.weightStep,
            exercise.startingWeight,
            slotIndex,
            slotId,
            altIndex,
            exercise.id,
            blockId,
          );
        }
      }
    }
  });
}

export async function getBlock(blockId: number): Promise<BlockDetails | null> {
  const db = await getDatabase();
  const block = await db.getFirstAsync<{ id: number; name: string }>(
    'SELECT id, name FROM blocks WHERE id = ?',
    blockId,
  );
  if (!block) {
    return null;
  }
  const exercises = await listExercises(blockId);
  return { ...block, slots: groupExercisesIntoSlots(exercises) };
}

export async function getBlockPreview(blockId: number): Promise<BlockPreview | null> {
  const block = await getBlock(blockId);
  if (!block) {
    return null;
  }
  const slots: PreviewSlot[] = [];
  for (const slot of block.slots) {
    const variants: PreviewLine[] = [];
    for (const exercise of slot.variants) {
      const previous = await previousExercise(blockId, exercise.id);
      variants.push({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weightStep: exercise.weightStep,
        startingWeight: exercise.startingWeight,
        previousWeight: previous?.weight ?? null,
        previousCompleted: previous ? previous.completed : null,
        previousComment: previous?.comment ?? null,
      });
    }
    slots.push({ slotId: slot.slotId, variants });
  }
  return { id: block.id, name: block.name, slots };
}

export async function getActiveSession(): Promise<SessionSummary | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(`
    SELECT s.id, s.block_id, b.name AS block_name, s.planned_date, s.status, s.started_at, s.finished_at
    FROM sessions s
    JOIN blocks b ON b.id = s.block_id
    WHERE s.status = 'planned' AND s.started_at IS NOT NULL
    ORDER BY s.started_at DESC, s.id DESC
    LIMIT 1
  `);
  return row ? toSessionSummary(row) : null;
}

export async function listHistory(): Promise<SessionSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(`
    SELECT s.id, s.block_id, b.name AS block_name, s.planned_date, s.status, s.started_at, s.finished_at
    FROM sessions s
    JOIN blocks b ON b.id = s.block_id
    WHERE s.status = 'done'
    ORDER BY COALESCE(s.finished_at, s.planned_date) DESC, s.id DESC
  `);
  return rows.map(toSessionSummary);
}

export async function startWorkout(blockId: number): Promise<number> {
  const db = await getDatabase();
  const active = await db.getFirstAsync<{ id: number }>(`
    SELECT id FROM sessions
    WHERE block_id = ? AND status = 'planned' AND started_at IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `, blockId);
  if (active) {
    return active.id;
  }

  const sessionId = await insertSession(blockId, todayDate());
  await fillWeights(sessionId);
  await db.runAsync(
    'UPDATE sessions SET started_at = ? WHERE id = ?',
    new Date().toISOString(),
    sessionId,
  );
  return sessionId;
}

export async function getLastSession(): Promise<SessionDetails | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: number }>(`
    SELECT id FROM sessions
    WHERE status = 'done'
    ORDER BY COALESCE(finished_at, planned_date) DESC, id DESC
  `);
  if (!row) {
    return null;
  }
  return getSession(row.id);
}

export async function getSession(sessionId: number): Promise<SessionDetails | null> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<SessionRow>(`
    SELECT s.id, s.block_id, b.name AS block_name, s.planned_date, s.status, s.started_at, s.finished_at
    FROM sessions s
    JOIN blocks b ON b.id = s.block_id
    WHERE s.id = ?
  `, sessionId);
  if (!session) {
    return null;
  }

  const lines = await db.getAllAsync<{
    id: number;
    slot_id: number | null;
    exercise_id: number;
    name: string;
    sets: number;
    reps: number;
    weight_step: number;
    weight: number | null;
    completed: number | null;
    comment: string | null;
    selected: number | null;
  }>(`
    SELECT id, slot_id, exercise_id, name, sets, reps, weight_step, weight, completed, comment, selected
    FROM session_exercises
    WHERE session_id = ?
    ORDER BY sort_order, id
  `, sessionId);

  const sessionLines: SessionLine[] = [];
  for (const line of lines) {
    const previous = await previousExercise(session.block_id, line.exercise_id, sessionId);
    sessionLines.push({
      id: line.id,
      slotId: line.slot_id ?? line.exercise_id,
      name: line.name,
      sets: line.sets,
      reps: line.reps,
      weightStep: line.weight_step,
      weight: line.weight,
      completed: line.completed === null ? null : line.completed === 1,
      comment: line.comment,
      selected: line.selected === null ? null : line.selected === 1,
      previousWeight: previous?.weight ?? null,
      previousCompleted: previous ? previous.completed : null,
      previousComment: previous?.comment ?? null,
      hasPrevious: previous !== null,
    });
  }

  return {
    id: session.id,
    blockId: session.block_id,
    blockName: session.block_name,
    plannedDate: session.planned_date,
    status: session.status,
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    lines: sessionLines,
  };
}

export async function chooseSessionAlternative(
  sessionId: number,
  slotId: number,
  lineId: number,
): Promise<void> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<{ status: SessionStatus }>(
    'SELECT status FROM sessions WHERE id = ?',
    sessionId,
  );
  if (!session || session.status !== 'planned') {
    throw new Error('Нельзя выбрать альтернативу в завершённой тренировке');
  }
  const chosen = await db.getFirstAsync<{ id: number; slot_id: number | null }>(
    'SELECT id, slot_id FROM session_exercises WHERE id = ? AND session_id = ?',
    lineId,
    sessionId,
  );
  if (!chosen || (chosen.slot_id ?? chosen.id) !== slotId) {
    throw new Error('Упражнение не найдено в этом слоте');
  }
  const locked = await db.getFirstAsync<{ id: number }>(`
    SELECT id FROM session_exercises
    WHERE session_id = ?
      AND COALESCE(slot_id, exercise_id) = ?
      AND completed IS NOT NULL
    LIMIT 1
  `, sessionId, slotId);
  if (locked) {
    throw new Error('Нельзя сменить альтернативу после отметки');
  }
  await db.runAsync(
    `UPDATE session_exercises
     SET selected = CASE WHEN id = ? THEN 1 ELSE 0 END
     WHERE session_id = ? AND COALESCE(slot_id, exercise_id) = ?`,
    lineId,
    sessionId,
    slotId,
  );
}

export async function setLineWeight(lineId: number, weight: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE session_exercises SET weight = ? WHERE id = ?', weight, lineId);
}

export async function setLineCompleted(lineId: number, completed: boolean, comment: string | null): Promise<void> {
  const db = await getDatabase();
  const trimmed = comment?.trim() ?? '';
  await db.runAsync(
    'UPDATE session_exercises SET completed = ?, comment = ? WHERE id = ?',
    completed ? 1 : 0,
    trimmed.length > 0 ? trimmed : null,
    lineId,
  );
}

export async function completeSession(sessionId: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM session_exercises WHERE session_id = ? AND selected = 0',
      sessionId,
    );
    await db.runAsync(
      `UPDATE sessions
       SET status = 'done', finished_at = ?
       WHERE id = ? AND status = 'planned'`,
      new Date().toISOString(),
      sessionId,
    );
  });
}

export async function listLatestSuccessfulWeights(): Promise<LatestSuccessfulWeight[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    exerciseId: number;
    name: string;
    blockName: string;
    weight: number | null;
    weightStep: number;
    sets: number;
    reps: number;
    succeededAt: string | null;
  }>(`
    SELECT
      e.id AS exerciseId,
      e.name AS name,
      b.name AS blockName,
      e.weight_step AS weightStep,
      e.sets AS sets,
      e.reps AS reps,
      last.weight AS weight,
      last.succeededAt AS succeededAt
    FROM exercises e
    JOIN blocks b ON b.id = e.block_id
    LEFT JOIN (
      SELECT
        se.exercise_id AS exerciseId,
        se.weight AS weight,
        COALESCE(s.finished_at, s.planned_date) AS succeededAt
      FROM session_exercises se
      JOIN sessions s ON s.id = se.session_id
      WHERE s.status = 'done'
        AND se.completed = 1
        AND se.exercise_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM session_exercises se2
          JOIN sessions s2 ON s2.id = se2.session_id
          WHERE se2.exercise_id = se.exercise_id
            AND s2.status = 'done'
            AND se2.completed = 1
            AND (
              COALESCE(s2.finished_at, s2.planned_date) > COALESCE(s.finished_at, s.planned_date)
              OR (
                COALESCE(s2.finished_at, s2.planned_date) = COALESCE(s.finished_at, s.planned_date)
                AND s2.id > s.id
              )
            )
        )
    ) last ON last.exerciseId = e.id
    ORDER BY b.name COLLATE NOCASE, e.sort_order, e.alt_order, e.id
  `);
  return rows;
}

async function listExercises(blockId: number): Promise<Exercise[]> {
  const db = await getDatabase();
  return db.getAllAsync<Exercise>(`
    SELECT id,
      COALESCE(slot_id, id) AS slotId,
      name, sets, reps,
      weight_step AS weightStep,
      starting_weight AS startingWeight
    FROM exercises
    WHERE block_id = ?
    ORDER BY sort_order, alt_order, id
  `, blockId);
}

async function previousExercise(blockId: number, exerciseId: number, exceptSessionId?: number) {
  const db = await getDatabase();
  return db.getFirstAsync<{ weight: number | null; completed: number | null; comment: string | null }>(`
    SELECT se.weight, se.completed, se.comment
    FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE s.block_id = ?
      AND s.status = 'done'
      AND se.exercise_id = ?
      AND (? IS NULL OR s.id != ?)
    ORDER BY COALESCE(s.finished_at, s.planned_date) DESC, s.id DESC
    LIMIT 1
  `, blockId, exerciseId, exceptSessionId ?? null, exceptSessionId ?? null).then((row) => {
    if (!row) {
      return null;
    }
    return {
      weight: row.weight,
      completed: row.completed === null ? null : row.completed === 1,
      comment: row.comment,
    };
  });
}

async function insertSession(blockId: number, plannedDate: string): Promise<number> {
  const db = await getDatabase();
  const exercises = await db.getAllAsync<ExerciseRow>(`
    SELECT id,
      COALESCE(slot_id, id) AS slot_id,
      name, sets, reps, weight_step, starting_weight, sort_order,
      COALESCE(alt_order, 0) AS alt_order
    FROM exercises
    WHERE block_id = ?
    ORDER BY sort_order, alt_order, id
  `, blockId);
  if (exercises.length === 0) {
    throw new Error('В блоке нет упражнений');
  }

  let sessionId = 0;
  await db.withTransactionAsync(async () => {
    const created = await db.runAsync(
      `INSERT INTO sessions (block_id, planned_date, status, completed_all, started_at, finished_at)
       VALUES (?, ?, 'planned', NULL, NULL, NULL)`,
      blockId,
      plannedDate,
    );
    sessionId = created.lastInsertRowId;
    const slotCounts = new Map<number, number>();
    for (const exercise of exercises) {
      slotCounts.set(exercise.slot_id, (slotCounts.get(exercise.slot_id) ?? 0) + 1);
    }
    for (const exercise of exercises) {
      const selected = (slotCounts.get(exercise.slot_id) ?? 1) > 1 ? null : 1;
      await db.runAsync(
        `INSERT INTO session_exercises
          (session_id, exercise_id, name, sets, reps, weight_step, weight, completed, sort_order, slot_id, selected)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        sessionId,
        exercise.id,
        exercise.name,
        exercise.sets,
        exercise.reps,
        exercise.weight_step,
        exercise.sort_order,
        exercise.slot_id,
        selected,
      );
    }
  });
  return sessionId;
}

async function fillWeights(sessionId: number): Promise<void> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<{ block_id: number }>(
    'SELECT block_id FROM sessions WHERE id = ?',
    sessionId,
  );
  if (!session) {
    return;
  }
  const exercises = await listExercises(session.block_id);
  const startingById = new Map(exercises.map((exercise) => [exercise.id, exercise.startingWeight]));
  const lines = await db.getAllAsync<{ id: number; exercise_id: number; weight: number | null }>(`
    SELECT id, exercise_id, weight FROM session_exercises WHERE session_id = ?
  `, sessionId);
  for (const line of lines) {
    if (line.weight !== null) {
      continue;
    }
    const previous = await previousExercise(session.block_id, line.exercise_id, sessionId);
    await db.runAsync(
      'UPDATE session_exercises SET weight = ? WHERE id = ?',
      previous?.weight ?? startingById.get(line.exercise_id) ?? 0,
      line.id,
    );
  }
}

function toSessionSummary(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    blockId: row.block_id,
    blockName: row.block_name,
    plannedDate: row.planned_date,
    status: row.status,
  };
}
