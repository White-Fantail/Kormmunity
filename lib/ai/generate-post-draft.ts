import type { CategoryType } from '@prisma/client';

import type { ManagedAuthorContext } from '@/lib/ai/managed-author';
import { generateJsonWithChatModel } from '@/lib/ai/client';
import { validateGeneratedPostDraft } from '@/lib/ai/validation';

type GeneratePostDraftInput = {
  author: ManagedAuthorContext;
  categoryName: string;
  categoryType: CategoryType;
  countryName: string | null;
  cityName: string | null;
  tags: string[];
  currentTitle: string;
  currentBody: string;
  additionalInstructions: string;
};

type PostDraftResponse = {
  title?: string;
  body?: string;
};

function buildSystemPrompt(author: ManagedAuthorContext) {
  const accountMode =
    author.accountType === 'OPERATOR'
      ? '운영 공지/안내 성격을 우선하되 친절하고 명확하게 작성'
      : '커뮤니티 참여형 페르소나처럼 자연스럽고 따뜻하게 작성';

  return [
    '너는 한국어 커뮤니티 게시글 초안을 작성하는 도우미다.',
    '항상 JSON 객체로만 응답한다: {"title":"...", "body":"..."}',
    'title과 body는 반드시 채운다.',
    '과장, 허위, 혐오, 공격적 표현, 반복 도배 문구는 금지한다.',
    accountMode,
  ].join('\n');
}

function buildUserPrompt(input: GeneratePostDraftInput) {
  const tagsText = input.tags.length > 0 ? input.tags.join(', ') : '없음';
  return [
    `운영계정: ${input.author.displayName} (${input.author.accountType})`,
    `운영계정 소개: ${input.author.shortBio ?? '없음'}`,
    `personaNotes: ${input.author.personaNotes ?? '없음'}`,
    `toneNotes: ${input.author.toneNotes ?? '없음'}`,
    `activityNotes: ${input.author.activityNotes ?? '없음'}`,
    `국가: ${input.countryName ?? '전체'}`,
    `지역: ${input.cityName ?? '전체'}`,
    `카테고리: ${input.categoryName} (${input.categoryType})`,
    `태그: ${tagsText}`,
    `작성 중인 제목(참고): ${input.currentTitle || '없음'}`,
    `작성 중인 본문(참고): ${input.currentBody || '없음'}`,
    `추가 지시사항: ${input.additionalInstructions || '없음'}`,
    '요구사항:',
    '- 한국어 제목 1개 + 본문 1개',
    '- 너무 길지 않게, 실제 게시 가능한 자연스러운 톤',
    '- 카테고리 성격에 맞춰 작성',
    '- 추가 지시사항이 있으면 반드시 반영한다',
  ].join('\n');
}

export async function generatePostDraft(input: GeneratePostDraftInput) {
  const response = await generateJsonWithChatModel<PostDraftResponse>({
    systemPrompt: buildSystemPrompt(input.author),
    userPrompt: buildUserPrompt(input),
    temperature: 0.8,
    maxTokens: 700,
    task: 'post',
  });

  return validateGeneratedPostDraft(
    {
      title: response.title,
      body: response.body,
    },
    input.categoryType,
  );
}
