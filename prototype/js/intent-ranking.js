// cosine 不是概率；仅用于决定是否值得向玩家展示候选，绝不直接执行。
export const INTENT_MIN_SCORE = Object.freeze({ zh: 0.55, en: 0.65 });

export function rankIntentScores(scores, { minScore = 0.55, ambiguityGap = 0.08 } = {}) {
  const ordered = scores.filter(x => Number.isFinite(x.score)).sort((a, b) => b.score - a.score);
  const best = ordered[0];
  if (!best || best.score < minScore) return { kind: 'none' };
  const close = ordered.filter(x => x.score >= minScore && best.score - x.score <= ambiguityGap).slice(0, 3);
  return { kind: 'suggest', candidateIds: close.map(x => x.id) };
}
