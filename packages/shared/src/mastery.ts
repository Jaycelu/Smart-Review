export type MasteryDimension = "retention" | "discrimination" | "transfer" | "generation";
export type MasteryStage = "initial" | "recheck";
export type MasteryConfidence = "high" | "medium" | "low";

export interface MasteryGradeItemLike {
  dimension: MasteryDimension;
  score: 0 | 1 | 2;
  sourceEvidence: string[];
  referenceAnswer: string;
  reason: string;
  confidence: number;
}

export interface MasteryGradeLike {
  items: MasteryGradeItemLike[];
}

export function passesMasteryGate(stage: MasteryStage, grade: MasteryGradeLike): boolean {
  const score = (dimension: MasteryDimension): number => grade.items.find((item) => item.dimension === dimension)?.score ?? 0;
  if (stage === "recheck") {
    return score("retention") === 2 && score("transfer") === 2;
  }
  return score("retention") === 2 && score("discrimination") >= 1 && score("transfer") === 2 && score("generation") >= 1 && grade.items.every((item) => item.score > 0);
}

export function calculateMasteryConfidence(examiner: MasteryGradeLike, verifier: MasteryGradeLike | null, source = ""): MasteryConfidence {
  const completeEvidence = examiner.items.every((item) => hasGroundedEvidence(item, source));
  if (!completeEvidence) return "low";
  if (verifier === null) {
    return examiner.items.every((item) => item.confidence >= 0.7) ? "medium" : "low";
  }
  const verifierEvidence = verifier.items.every((item) => hasGroundedEvidence(item, source));
  const deltas = examiner.items.map((item) => Math.abs(item.score - (verifier.items.find((candidate) => candidate.dimension === item.dimension)?.score ?? -1)));
  if (!verifierEvidence || deltas.some((delta) => delta > 1)) return "low";
  if (deltas.every((delta) => delta === 0) && [...examiner.items, ...verifier.items].every((item) => item.confidence >= 0.75)) return "high";
  return "medium";
}

function hasGroundedEvidence(item: MasteryGradeItemLike, source: string): boolean {
  return item.sourceEvidence.length > 0 && item.referenceAnswer.length > 0 && item.reason.length > 0 && evidenceIsGrounded(item.sourceEvidence, source);
}

function evidenceIsGrounded(evidence: string[], source: string): boolean {
  if (source.length === 0) return true;
  const normalizedSource = normalizeEvidence(source);
  return evidence.every((excerpt) => normalizedSource.includes(normalizeEvidence(excerpt)));
}

function normalizeEvidence(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
