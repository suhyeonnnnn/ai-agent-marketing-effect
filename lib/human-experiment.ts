// ──────────────────────────────────────────────
//  Human Experiment Logic — B2A Experiment
//  Shared randomization & assignment for Prolific studies
// ──────────────────────────────────────────────

import { CATEGORIES, type CategoryId } from "./categories";
import { type Condition } from "./products";

// ──────────────────────────────────────────────
//  Seeded PRNG — Mulberry32 (same as agent experiment)
// ──────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle with seeded PRNG
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ──────────────────────────────────────────────
//  Condition Pool (matches protocol doc: 6 conditions)
// ──────────────────────────────────────────────

export const HUMAN_CONDITIONS: Condition[] = [
  "control",
  "scarcity",
  "social_proof_a",
  "urgency",
  "authority_a",
  "price_anchoring",
];

export const CATEGORY_IDS: CategoryId[] = ["serum", "smartwatch", "milk", "dress"];

// ──────────────────────────────────────────────
//  Study 2 Funnel Levels
// ──────────────────────────────────────────────

export type FunnelLevel = "vague" | "moderate" | "specific";
export const FUNNEL_LEVELS: FunnelLevel[] = ["vague", "moderate", "specific"];

// ──────────────────────────────────────────────
//  Scenario Text for Human Participants
//
//  Derived from agent prompts (categories.ts agencyPrompts).
//  Same information conditions (criteria specificity) but adapted
//  for human participants:
//    - 1st person → 2nd person ("I'm looking" → "You're looking")
//    - Remove delegation phrases ("Pick the best one for me")
//    - Participant shops for themselves, not for others
//
//  This preserves the independent variable (funnel specificity)
//  while making the task natural for human participants.
// ──────────────────────────────────────────────

const HUMAN_SCENARIOS: Record<CategoryId, Record<FunnelLevel, string>> = {
  serum: {
    vague: "You're interested in trying a facial serum.",
    moderate: "You're looking for a hydrating facial serum. You're still exploring your options.",
    specific: "You need a hydrating facial serum under $17, rated 4.5 or above, for dry sensitive skin.",
  },
  smartwatch: {
    vague: "You're interested in getting a fitness smartwatch.",
    moderate: "You're looking for a fitness smartwatch with heart rate monitoring. You're still exploring your options.",
    specific: "You need a fitness smartwatch under $167, rated 4.4 or above, suitable for running and everyday wear.",
  },
  milk: {
    vague: "You're interested in buying some organic whole milk.",
    moderate: "You're looking for fresh whole milk that's safe for young children. You're still exploring your options.",
    specific: "You need organic whole milk under $7.30, rated 4.6 or above, safe for young children and suitable for everyday use.",
  },
  dress: {
    vague: "You're interested in buying a casual dress.",
    moderate: "You're looking for a casual midi dress suitable for office wear. You're still exploring your options.",
    specific: "You need a casual midi dress under $37, rated 4.3 or above, suitable for office wear and easy to maintain.",
  },
};

export function getFunnelScenario(catId: CategoryId, funnel: FunnelLevel): string {
  return HUMAN_SCENARIOS[catId][funnel];
}

// Study 1 uses the vague scenario
export function getStudy1Scenario(catId: CategoryId): string {
  return HUMAN_SCENARIOS[catId].vague;
}

// ──────────────────────────────────────────────
//  Assignment Types
// ──────────────────────────────────────────────

export interface RoundConfig {
  round: number;
  categoryId: CategoryId;
  condition: Condition;
  targetProductId: number;
  positionOrder: number[];
  funnel?: FunnelLevel;
  scenario: string;
}

export interface ExperimentAssignment {
  participantId: string;
  studyId: string;
  sessionId: string;
  studyType: "study1" | "study2";
  rounds: RoundConfig[];
  assignedAt: string;
  seed: number;
}

/**
 * Generate a deterministic seed from Prolific participant ID
 */
function participantSeed(pid: string): number {
  let hash = 0;
  for (let i = 0; i < pid.length; i++) {
    hash = ((hash << 5) - hash + pid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Generate Study 1 assignment: 4 rounds, each with a different category,
 * 4 conditions randomly drawn from the 6-condition pool.
 */
export function generateStudy1Assignment(
  participantId: string,
  studyId: string,
  sessionId: string
): ExperimentAssignment {
  const seed = participantSeed(participantId);
  const rng = mulberry32(seed);

  const categories = seededShuffle(CATEGORY_IDS, rng);
  const conditionPool = seededShuffle(HUMAN_CONDITIONS, rng).slice(0, 4);

  const rounds: RoundConfig[] = categories.map((catId, i) => {
    const cat = CATEGORIES[catId];
    const condition = conditionPool[i];
    const targetIdx = Math.floor(rng() * cat.products.length);
    const targetProductId = cat.products[targetIdx].id;
    const positionOrder = seededShuffle(
      cat.products.map((p) => p.id),
      mulberry32(seed + i * 1000 + 7)
    );

    return {
      round: i + 1,
      categoryId: catId,
      condition,
      targetProductId,
      positionOrder,
      scenario: getStudy1Scenario(catId),
    };
  });

  return {
    participantId,
    studyId,
    sessionId,
    studyType: "study1",
    rounds,
    assignedAt: new Date().toISOString(),
    seed,
  };
}

/**
 * Generate Study 2 assignment: 4 rounds with free browsing,
 * funnel levels rotated across rounds.
 */
export function generateStudy2Assignment(
  participantId: string,
  studyId: string,
  sessionId: string
): ExperimentAssignment {
  const seed = participantSeed(participantId);
  const rng = mulberry32(seed + 5555);

  const categories = seededShuffle(CATEGORY_IDS, rng);
  const conditionPool = seededShuffle(HUMAN_CONDITIONS, rng).slice(0, 4);

  // 3 funnel levels for 4 rounds → one repeats
  const funnelPool: FunnelLevel[] = [...FUNNEL_LEVELS, FUNNEL_LEVELS[Math.floor(rng() * 3)]];
  const funnels = seededShuffle(funnelPool, rng);

  const rounds: RoundConfig[] = categories.map((catId, i) => {
    const cat = CATEGORIES[catId];
    const condition = conditionPool[i];
    const funnel = funnels[i];
    const targetIdx = Math.floor(rng() * cat.products.length);
    const targetProductId = cat.products[targetIdx].id;
    const positionOrder = seededShuffle(
      cat.products.map((p) => p.id),
      mulberry32(seed + 5555 + i * 1000 + 7)
    );

    return {
      round: i + 1,
      categoryId: catId,
      condition,
      targetProductId,
      positionOrder,
      funnel,
      scenario: getFunnelScenario(catId, funnel),
    };
  });

  return {
    participantId,
    studyId,
    sessionId,
    studyType: "study2",
    rounds,
    assignedAt: new Date().toISOString(),
    seed,
  };
}

// ──────────────────────────────────────────────
//  Logging Types
// ──────────────────────────────────────────────

export interface Study1LogEntry {
  participant_id: string;
  study_id: string;
  session_id: string;
  round: number;
  category: string;
  condition: string;
  target_product_id: number;
  target_position: number;
  selected_product_id: number;
  chose_target: 0 | 1;
  response_time_ms: number;
  position_order: number[];
  timestamp: string;
}

export interface Study2LogEntry extends Study1LogEntry {
  funnel: string;
  page_visits: string[];
  products_viewed: number;
  reviews_read: number;
  time_per_page_ms: number[];
  total_steps: number;
}

export interface SurveyResponse {
  participant_id: string;
  study_type: string;
  q1_important_factors: string[];
  q2_shopping_frequency: string;
  q3_age: string;
  q4_gender: string;
  q5_attention_check: string;
  attention_check_passed: boolean;
  timestamp: string;
}

// ──────────────────────────────────────────────
//  Prolific Completion
// ──────────────────────────────────────────────

export const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete";

export function getCompletionCode(studyType: "study1" | "study2"): string {
  return studyType === "study1" ? "C1A2B3D4" : "E5F6G7H8";
}
