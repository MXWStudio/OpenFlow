import type { DailyRequirementSession, RequirementProject } from './appState';
import type { ParsedRequirementJson } from './types/electron';
import type { DesktopExtractionCandidate } from '../../shared/extractionContract.ts';

export const DAILY_REQUIREMENT_TTL_MS = 24 * 60 * 60 * 1000;

export function formatExtractionTimeLabel(extractedAt?: string): string {
  if (!extractedAt) return '';
  const extractedDate = new Date(extractedAt);
  if (!Number.isFinite(extractedDate.getTime())) return '';
  const hours = String(extractedDate.getHours()).padStart(2, '0');
  const minutes = String(extractedDate.getMinutes()).padStart(2, '0');
  return `抓取于 ${hours}:${minutes}`;
}

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
        ...(project.taskId ? { taskId: project.taskId } : {}),
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

export function buildDailyRequirementSessionFromExtraction(
  candidate: DesktopExtractionCandidate,
  importedAt = Date.now(),
): DailyRequirementSession {
  const extractedDate = new Date(candidate.extractedAt);
  const fileDate = Number.isFinite(extractedDate.getTime())
    ? getLocalDateKey(extractedDate).replace(/-/g, '')
    : getLocalDateKey(new Date(importedAt)).replace(/-/g, '');
  const firstProject = candidate.payload.projects[0];
  const parsed: ParsedRequirementJson = {
    projectName: firstProject?.projectName || '',
    producerName: candidate.payload.projects.find((project) => project.producerName)?.producerName || '',
    department: '',
    email: '',
    sizes: [...new Set(candidate.payload.projects.flatMap((project) => project.sizes))],
    projects: candidate.payload.projects.map((project) => ({
      taskId: project.taskId,
      projectName: project.projectName,
      sizes: [...project.sizes],
      requirements: project.requirements.map((requirement) => ({ ...requirement })),
      ...(project.fullName ? { fullName: project.fullName } : {}),
      ...(project.producerName ? { producerName: project.producerName } : {}),
      ...(project.materialType ? { materialType: project.materialType } : {}),
    })),
    rawData: candidate.payload,
    fileName: `${fileDate}-扩展自动抓取.json`,
    warnings: [...candidate.payload.warnings],
  };
  return {
    ...buildDailyRequirementSession(parsed, importedAt),
    source: 'extension',
    sourceMessageId: candidate.messageId,
    extractedAt: candidate.extractedAt,
  };
}

export function decideExtractionCandidate(
  candidateMessageId: string,
  currentSourceMessageId: string,
  hasWorkflowContent: boolean,
): 'ignore' | 'auto-load' | 'confirm' {
  if (!candidateMessageId || candidateMessageId === currentSourceMessageId) {
    return 'ignore';
  }
  return hasWorkflowContent ? 'confirm' : 'auto-load';
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
