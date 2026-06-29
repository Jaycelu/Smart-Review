import { normalizePath, type App, type TFile } from "obsidian";
import { calculateMasteryConfidence, passesMasteryGate } from "@smart-review/shared";
import { completeStructuredAi } from "./ai-examiner";
import { markMastered, markMasteryPending, linkMasteryRecord, returnToReview } from "./review-lifecycle";
import type { AiConnectionSettings, SmartReviewSettings } from "./settings";
import { ensureParentFolder, formatLocalDateTime, getOptionalString, toFrontmatter } from "./utils";

export type MasteryDimension = "retention" | "discrimination" | "transfer" | "generation";
export type MasteryStage = "initial" | "recheck";
export type MasteryConfidence = "high" | "medium" | "low";
export type MasteryOutcome = "pass" | "fail" | "inconclusive";

export interface MasteryQuestion {
  dimension: MasteryDimension;
  prompt: string;
  rubric: string[];
  sourceEvidence: string[];
}

export interface MasteryExamDefinition {
  stage: MasteryStage;
  questions: MasteryQuestion[];
}

export interface MasteryAnswer {
  dimension: MasteryDimension;
  answer: string;
}

export interface MasteryGradeItem {
  dimension: MasteryDimension;
  score: 0 | 1 | 2;
  satisfied: string[];
  missing: string[];
  sourceEvidence: string[];
  referenceAnswer: string;
  reason: string;
  confidence: number;
}

export interface MasteryGrade {
  items: MasteryGradeItem[];
  overallReason: string;
}

export interface MasteryExamResult {
  outcome: MasteryOutcome;
  confidence: MasteryConfidence;
  examiner: MasteryGrade;
  verifier: MasteryGrade | null;
  recordPath: string;
  nextStep: string;
}

interface RunExamInput {
  app: App;
  settings: SmartReviewSettings;
  file: TFile;
  source: string;
  definition: MasteryExamDefinition;
  answers: MasteryAnswer[];
  examiner: AiConnectionSettings;
  verifier: AiConnectionSettings;
  locale: "en" | "zh";
}

export async function generateMasteryExam(
  connection: AiConnectionSettings,
  source: string,
  stage: MasteryStage,
  locale: "en" | "zh"
): Promise<MasteryExamDefinition> {
  const dimensions = stage === "recheck" ? ["retention", "transfer"] : ["retention", "discrimination", "transfer", "generation"];
  const language = locale === "zh" ? "Simplified Chinese" : "English";
  const result = await completeStructuredAi(
    connection,
    "You are a rigorous knowledge mastery examiner. Build questions and a hidden evidence-grounded rubric from only the supplied article. Return JSON only. Do not invent facts absent from the article.",
    `Create a ${stage} mastery exam in ${language}. Required dimensions: ${dimensions.join(", ")}.
For each dimension return one question, 2-5 concise rubric criteria, and 1-3 short source evidence excerpts.
JSON schema: {"questions":[{"dimension":"retention|discrimination|transfer|generation","prompt":"...","rubric":["..."],"sourceEvidence":["..."]}]}
ARTICLE:\n<<<\n${source}\n>>>`
  );
  return parseDefinition(result, stage, dimensions as MasteryDimension[]);
}

export async function runAndStoreMasteryExam(input: RunExamInput): Promise<MasteryExamResult> {
  const examinerGrade = await gradeAnswers(input.examiner, input.source, input.definition, input.answers, input.locale, false);
  const examinerPass = passesGate(input.definition.stage, examinerGrade);
  const borderline = getTotalScore(examinerGrade) >= (input.definition.stage === "initial" ? 5 : 3);
  let verifierGrade: MasteryGrade | null = null;
  if (examinerPass || borderline) {
    try {
      verifierGrade = await gradeAnswers(input.verifier, input.source, input.definition, input.answers, input.locale, true);
    } catch {
      verifierGrade = null;
    }
  }
  const confidence = calculateConfidence(examinerGrade, verifierGrade, input.source);
  const verifierPass = verifierGrade === null ? null : passesGate(input.definition.stage, verifierGrade);
  const outcome: MasteryOutcome = examinerPass
    ? (verifierPass === true && confidence !== "low" ? "pass" : "inconclusive")
    : (verifierPass === true ? "inconclusive" : "fail");

  const nextStep = getNextStep(input.definition.stage, outcome, input.locale);
  const recordPath = await appendMasteryRecord(input, examinerGrade, verifierGrade, confidence, outcome, nextStep);
  const recordLink = `[[${recordPath.replace(/\.md$/i, "")}]]`;

  if (outcome === "pass") {
    if (input.definition.stage === "initial") {
      await markMasteryPending(input.app, input.file, recordLink);
    } else {
      await markMastered(input.app, input.file, recordLink);
    }
  } else {
    await linkMasteryRecord(input.app, input.file, recordLink);
    if (input.definition.stage === "recheck" && outcome === "fail") {
      await returnToReview(input.app, input.file);
    }
  }

  return { outcome, confidence, examiner: examinerGrade, verifier: verifierGrade, recordPath, nextStep };
}

function parseDefinition(record: Record<string, unknown>, stage: MasteryStage, required: MasteryDimension[]): MasteryExamDefinition {
  const questions = readArray(record.questions).map((item) => {
    const value = asRecord(item);
    return {
      dimension: readDimension(value.dimension),
      prompt: readString(value.prompt),
      rubric: readStringArray(value.rubric),
      sourceEvidence: readStringArray(value.sourceEvidence)
    };
  });
  for (const dimension of required) {
    if (!questions.some((question) => question.dimension === dimension)) {
      throw new Error(`AI exam is missing dimension: ${dimension}`);
    }
  }
  return { stage, questions: required.map((dimension) => questions.find((question) => question.dimension === dimension) as MasteryQuestion) };
}

async function gradeAnswers(
  connection: AiConnectionSettings,
  source: string,
  definition: MasteryExamDefinition,
  answers: MasteryAnswer[],
  locale: "en" | "zh",
  independentVerification: boolean
): Promise<MasteryGrade> {
  const language = locale === "zh" ? "Simplified Chinese" : "English";
  const result = await completeStructuredAi(
    connection,
    `You are a ${independentVerification ? "second independent verifier" : "rigorous examiner"}. Grade only against the article and rubric. Return JSON only. A score of 2 requires an independently correct answer with no critical error; 1 is partial; 0 is absent, wrong, or contradicted. Do not reward verbosity. Every sourceEvidence item must be a short verbatim excerpt from the article.`,
    `Grade in ${language}.
JSON schema: {"items":[{"dimension":"retention|discrimination|transfer|generation","score":0,"satisfied":["..."],"missing":["..."],"sourceEvidence":["..."],"referenceAnswer":"...","reason":"...","confidence":0.0}],"overallReason":"..."}
EXAM AND HIDDEN RUBRIC:\n${JSON.stringify(definition)}
USER ANSWERS:\n${JSON.stringify(answers)}
ARTICLE:\n<<<\n${source}\n>>>`
  );
  return parseGrade(result, definition.questions.map((question) => question.dimension));
}

function parseGrade(record: Record<string, unknown>, dimensions: MasteryDimension[]): MasteryGrade {
  const parsed = readArray(record.items).map((item) => {
    const value = asRecord(item);
    return {
      dimension: readDimension(value.dimension),
      score: readScore(value.score),
      satisfied: readStringArray(value.satisfied),
      missing: readStringArray(value.missing),
      sourceEvidence: readStringArray(value.sourceEvidence),
      referenceAnswer: readString(value.referenceAnswer),
      reason: readString(value.reason),
      confidence: readConfidenceNumber(value.confidence)
    };
  });
  return {
    items: dimensions.map((dimension) => {
      const item = parsed.find((candidate) => candidate.dimension === dimension);
      if (item === undefined) throw new Error(`AI grade is missing dimension: ${dimension}`);
      return item;
    }),
    overallReason: readString(record.overallReason)
  };
}

export function passesGate(stage: MasteryStage, grade: MasteryGrade): boolean {
  return passesMasteryGate(stage, grade);
}

export function calculateConfidence(examiner: MasteryGrade, verifier: MasteryGrade | null, source = ""): MasteryConfidence {
  return calculateMasteryConfidence(examiner, verifier, source);
}

async function appendMasteryRecord(
  input: RunExamInput,
  examiner: MasteryGrade,
  verifier: MasteryGrade | null,
  confidence: MasteryConfidence,
  outcome: MasteryOutcome,
  nextStep: string
): Promise<string> {
  const path = resolveRecordPath(input.app, input.settings, input.file);
  await ensureParentFolder(input.app.vault.adapter, path);
  const existing = input.app.vault.getFileByPath(path);
  if (existing === null) {
    await input.app.vault.create(path, `---\nsource: ${JSON.stringify(`[[${input.file.path.replace(/\.md$/i, "")}]]`)}\n---\n\n# ${input.file.basename} - Mastery record\n`);
  }
  const attempts = (await countExistingAttempts(input.app, path)) + 1;
  const section = renderAttempt(input, examiner, verifier, confidence, outcome, nextStep, attempts);
  const record = input.app.vault.getFileByPath(path);
  if (record === null) throw new Error("Failed to create mastery record.");
  await input.app.vault.append(record, section);
  return path;
}

function resolveRecordPath(app: App, settings: SmartReviewSettings, file: TFile): string {
  const frontmatter = toFrontmatter(app.metadataCache.getFileCache(file)?.frontmatter);
  const link = getOptionalString(frontmatter.review_mastery_record);
  if (link !== undefined) {
    const linkPath = link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0]?.trim();
    if (linkPath !== undefined) {
      const destination = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
      if (destination !== null) return destination.path;
    }
  }
  const folder = normalizePath(settings.masteryRecordsPath.replace(/^\/+|\/+$/g, ""));
  const safeName = file.basename.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled";
  return normalizePath(`${folder}/${safeName}-${stableHash(file.path)}.md`);
}

async function countExistingAttempts(app: App, path: string): Promise<number> {
  const cache = app.vault.getFileByPath(path);
  if (cache === null) return 0;
  const content = await app.vault.cachedRead(cache);
  return content.match(/^## Attempt \d+/gm)?.length ?? 0;
}

function renderAttempt(input: RunExamInput, examiner: MasteryGrade, verifier: MasteryGrade | null, confidence: MasteryConfidence, outcome: MasteryOutcome, nextStep: string, attempt: number): string {
  const answerByDimension = new Map(input.answers.map((answer) => [answer.dimension, answer.answer]));
  const lines = [
    "",
    `## Attempt ${attempt} - ${formatLocalDateTime()}`,
    "",
    `- Stage: ${input.definition.stage}`,
    `- Outcome: ${outcome}`,
    `- Confidence: ${confidence}`,
    `- Examiner: ${input.examiner.provider} / ${input.examiner.model}`,
    `- Verifier: ${verifier === null ? "not run" : `${input.verifier.provider} / ${input.verifier.model}`}`,
    `- Source fingerprint: ${stableHash(input.source)}`,
    `- Next step: ${nextStep}`,
    ""
  ];
  for (const question of input.definition.questions) {
    const grade = examiner.items.find((item) => item.dimension === question.dimension);
    if (grade === undefined) continue;
    lines.push(
      `### ${question.dimension} - ${grade.score}/2`,
      "",
      `**Question:** ${question.prompt}`,
      "",
      "**Answer:**",
      quoteMarkdown(answerByDimension.get(question.dimension) ?? ""),
      "",
      `**Reason:** ${grade.reason}`,
      "",
      `**Missing:** ${grade.missing.length > 0 ? grade.missing.join("; ") : "None"}`,
      "",
      `**Source evidence:** ${grade.sourceEvidence.join("; ")}`,
      "",
      `**Reference answer:** ${grade.referenceAnswer}`,
      ""
    );
  }
  if (verifier !== null) {
    lines.push("### Independent verification", "", verifier.overallReason, "");
  }
  return `${lines.join("\n")}\n`;
}

function getNextStep(stage: MasteryStage, outcome: MasteryOutcome, locale: "en" | "zh"): string {
  if (locale === "zh") {
    if (outcome === "inconclusive") return "证据或两次评分不一致，保留原状态，可稍后重新检验。";
    if (outcome === "fail") return stage === "recheck" ? "返回普通复习，7 天后再次复习。" : "继续当前复习计划，补足缺失知识后再检验。";
    return stage === "initial" ? "30 天后进行延迟复检。" : "已通过延迟复检，标记为已掌握。";
  }
  if (outcome === "inconclusive") return "Evidence or grades conflict. Keep the current state and retry later.";
  if (outcome === "fail") return stage === "recheck" ? "Return to normal review in 7 days." : "Continue the current review plan and address the gaps.";
  return stage === "initial" ? "Run a delayed recheck in 30 days." : "Delayed recheck passed; marked mastered.";
}

function getTotalScore(grade: MasteryGrade): number {
  return grade.items.reduce((total, item) => total + item.score, 0);
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function quoteMarkdown(value: string): string {
  return value.split("\n").map((line) => `> ${line}`).join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected object in AI response.");
  return value as Record<string, unknown>;
}

function readArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected array in AI response.");
  return value;
}

function readString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error("Expected non-empty text in AI response.");
  return value.trim();
}

function readStringArray(value: unknown): string[] {
  return readArray(value).map(readString);
}

function readDimension(value: unknown): MasteryDimension {
  if (value === "retention" || value === "discrimination" || value === "transfer" || value === "generation") return value;
  throw new Error("Invalid mastery dimension.");
}

function readScore(value: unknown): 0 | 1 | 2 {
  if (value === 0 || value === 1 || value === 2) return value;
  throw new Error("Invalid mastery score.");
}

function readConfidenceNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
