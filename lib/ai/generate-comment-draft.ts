import type { CategoryType } from '@prisma/client';

import type { ManagedAuthorContext } from '@/lib/ai/managed-author';
import { generateJsonWithChatModel } from '@/lib/ai/client';
import { validateGeneratedCommentBody } from '@/lib/ai/validation';

type ExistingComment = {
  authorDisplayName: string;
  body: string;
};

type GenerateCommentDraftInput = {
  author: ManagedAuthorContext;
  categoryName: string;
  categoryType: CategoryType;
  countryName: string | null;
  cityName: string | null;
  tags: string[];
  postTitle: string | null;
  postBody: string;
  existingComments: ExistingComment[];
  currentCommentBody: string;
};

type CommentDraftResponse = {
  commentBody?: string;
};

function buildSystemPrompt(author: ManagedAuthorContext) {
  const accountMode =
    author.accountType === 'OPERATOR'
      ? '운영자/안내 계정처럼 친절하고 질서있는 톤을 유지'
      : '커뮤니티 참여형 페르소나처럼 자연스럽고 공감형 톤을 유지';

  return [
    '너는 한국어 댓글 초안 추천 도우미다.',
    '항상 JSON 객체로만 응답한다: {"commentBody":"..."}',
    'commentBody는 반드시 채운다.',
    '기존 댓글과 충돌하거나 중복되지 않게 작성한다.',
    '공격적 표현, 개인정보 요청, 반복 도배 문구는 금지한다.',
    accountMode,
  ].join('\n');
}

function buildUserPrompt(input: GenerateCommentDraftInput) {
  const tagsText = input.tags.length > 0 ? input.tags.join(', ') : '없음';
  const commentsText =
    input.existingComments.length > 0
      ? input.existingComments
          .map((comment, index) => `${index + 1}. ${comment.authorDisplayName}: ${comment.body}`)
          .join('\n')
      : '기존 댓글 없음';

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
    `게시글 제목: ${input.postTitle ?? '없음'}`,
    `게시글 본문: ${input.postBody}`,
    `기존 댓글 목록:\n${commentsText}`,
    `작성 중인 댓글(참고): ${input.currentCommentBody || '없음'}`,
    '요구사항:',
    '- 게시글 맥락을 이어가는 한국어 댓글 1개',
    '- 기존 댓글을 반복하지 말 것',
    '- 커뮤니티 규칙에 맞는 안전한 표현 사용',
  ].join('\n');
}

export async function generateCommentDraft(input: GenerateCommentDraftInput) {
  const response = await generateJsonWithChatModel<CommentDraftResponse>({
    systemPrompt: buildSystemPrompt(input.author),
    userPrompt: buildUserPrompt(input),
    temperature: 0.8,
    maxTokens: 500,
    task: 'comment',
  });

  return validateGeneratedCommentBody(response.commentBody);
}
