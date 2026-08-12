import type { DailyRequirementSession, RequirementProject } from './appState';
import type { ParsedRequirementJson } from './types/electron';

export const DAILY_REQUIREMENT_TTL_MS = 24 * 60 * 60 * 1000;

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function getLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

function normalizeProjects(projects: ParsedRequirementJson['projects']): RequirementProject[] {
  return Array.isArray(projects)
    ? projects.map((project) => ({
        projectName: project.projectName,
        sizes: [...(project.sizes || [])],
        ...(project.requirements ? { requirements: project.requirements.map((requirement) => ({ ...requirement })) } : {}),
        ...(project.fullName ? { fullName: project.fullName } : {}),
        ...(project.producerName ? { producerName: project.producerName } : {}),
        ...(project.materialType ? { materialType: project.materialType } : {}),
      }))
    : [];
}

export function buildDailyRequirementSession(
  parsed: ParsedRequirementJson,
  importedAt = Date.now(),
): DailyRequirementSession {
  return {
    importedAt,
    importedDateKey: getLocalDateKey(new Date(importedAt)),
    fileName: parsed.fileName ?? '',
    sizes: [...(parsed.sizes || [])],
    projects: normalizeProjects(parsed.projects),
    ...(parsed.producerName ? { producerName: parsed.producerName } : {}),
    ...(parsed.department ? { department: parsed.department } : {}),
    ...(parsed.email ? { email: parsed.email } : {}),
    ...(parsed.warnings ? { warnings: [...parsed.warnings] } : {}),
  };
}

export function isFreshDailyRequirementSession(
  session: DailyRequirementSession | null | undefined,
  now = Date.now(),
) {
  if (!session || typeof session.importedAt !== 'number' || !session.importedDateKey) return false;
  if (now < session.importedAt) return false;

  const sameLocalDate = session.importedDateKey === getLocalDateKey(new Date(now));
  const withinTtl = now - session.importedAt < DAILY_REQUIREMENT_TTL_MS;
  return sameLocalDate && withinTtl;
}
