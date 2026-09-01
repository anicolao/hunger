import { getRepository, type AppetiteRepository } from '../data/repository';
import type { Program } from '../data/schema';
import { getProgramProgress } from '../domain/progression';

export function deriveProgramLifecycle(program: Program, now: number): Program {
  if (program.status === 'complete') return program;
  const progress = getProgramProgress(program.startedAt, now, program.timeZone);
  return progress.complete ? { ...program, status: 'complete' } : program;
}

export async function reconcileProgramLifecycle(
  now: number,
  repository: AppetiteRepository = getRepository()
): Promise<Program | null> {
  const program = await repository.getProgram();
  if (!program) return null;
  const derived = deriveProgramLifecycle(program, now);
  if (derived.status !== program.status) {
    await repository.append({
      type: 'program/status-changed',
      occurredAt: now,
      payload: { program: derived }
    });
  }
  return derived;
}
