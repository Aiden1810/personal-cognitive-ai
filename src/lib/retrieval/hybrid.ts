import { hasDifferentStudySubject, matchProfileText } from "../profile/relevance.ts";

export interface SemanticMatches {
  model: string;
  insights: Record<string, number>;
  goals: Record<string, number>;
}

// Experimental threshold for this model only; not a probability or confidence score.
export const MIN_SEMANTIC_SIMILARITY = 0.55;

export function hybridMatch(text: string, question: string, similarity?: number, hybrid = similarity !== undefined) {
  const lexical = matchProfileText(text, question);
  const semanticSimilarity = Number.isFinite(similarity) && similarity! >= -1 && similarity! <= 1
    ? similarity : undefined;
  if (hasDifferentStudySubject(text, question)) return { ...lexical, score: 0 };
  const semanticRelevant = semanticSimilarity !== undefined && semanticSimilarity >= MIN_SEMANTIC_SIMILARITY;
  if (!lexical.score && !semanticRelevant) return { ...lexical, score: 0 };
  return {
    ...lexical,
    score: !hybrid ? lexical.score :
      0.4 * lexical.score / (lexical.score + 6) + 0.6 * Math.max(0, semanticSimilarity ?? 0),
    ...(semanticRelevant ? { semanticSimilarity } : {}),
  };
}
