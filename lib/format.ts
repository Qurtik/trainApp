const KG_TO_LBS = 2.2046226218;

export function roundKg(weight: number): number {
  return Math.round(weight * 10) / 10;
}

export function roundLbs(weight: number): number {
  return Math.round(weight);
}

export function kgToLbs(kg: number): number {
  return roundLbs(kg * KG_TO_LBS);
}

export function lbsToKg(lbs: number): number {
  return roundKg(lbs / KG_TO_LBS);
}

export function formatWeight(weight: number): string {
  return String(roundKg(weight));
}

export function isBodyweight(weight: number | null | undefined): boolean {
  return weight == null || weight <= 0;
}

export function formatWeightLabel(weight: number | null | undefined): string {
  if (weight == null || weight <= 0) {
    return 'свой вес';
  }
  return `${formatWeight(weight)} кг`;
}

export function shiftWeight(weight: number, step: number): number {
  const next = roundKg(weight + step);
  return next < 0 ? 0 : next;
}

export function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parsePositiveInt(value: string): number | null {
  const parsed = parsePositiveNumber(value);
  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

export function formatDuration(fromIso: string, toMs = Date.now()): string {
  const elapsed = Math.max(0, toMs - new Date(fromIso).getTime());
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}
