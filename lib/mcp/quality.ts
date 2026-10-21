/**
 * Reject greeting-only filler and near-duplicates. This is a deterministic floor,
 * not an AI factuality check: the operator still reviews any invented claims.
 */
export function normalizedText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function similarity(left: string, right: string) {
  const a = normalizedText(left), b = normalizedText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s: string) => new Set(
    Array.from({ length: Math.max(1, s.length - 3) }, (_, i) => s.slice(i, i + 4)),
  );
  const x = grams(a), y = grams(b);
  const union = new Set([...x, ...y]);
  let overlap = 0;
  for (const gram of x) if (y.has(gram)) overlap++;
  return overlap / union.size;
}

export function checkSubstantivePost(title: string | null, body: string) {
  const content = body.trim();
  if (normalizedText(content).length < 55) {
    return 'A meaningful community post must contain substantive information (55+ non-space characters).';
  }
  const generic = [
    /^(안녕하세요|좋은아침|좋은저녁|굿모닝|반갑습니다|오늘도)[\s!~.,가-힣]*(좋은하루|화이팅|파이팅|행복한하루)[\s!~.,가-힣]*$/i,
    /^(hi|hello|good morning|good evening|have a great day)[\s!.,a-z]*$/i,
  ];
  if (generic.some((pattern) => pattern.test(content.replace(/\n/g, ' ')))) {
    return 'Greeting-only content is not allowed; add a useful insight, question or specific discussion.';
  }
  if ((title || '').length > 180 || content.length > 10000) {
    return 'Title or body is too long.';
  }
  return null;
}
