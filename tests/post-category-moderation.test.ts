import test from 'node:test';
import assert from 'node:assert/strict';
import { CategoryType } from '@prisma/client';

import { getPostCategoryModerationResult } from '../lib/posts/post-category-moderation.ts';

test('같은 카테고리로 변경하면 아무 작업도 하지 않는다', () => {
  const result = getPostCategoryModerationResult({
    currentCategory: { id: 'category-1', name: '자유', type: CategoryType.GENERAL },
    nextCategory: { id: 'category-1', name: '자유', type: CategoryType.GENERAL },
    hasPrice: false,
  });

  assert.deepEqual(result, {
    ok: true,
    noop: true,
    clearPrice: false,
    clearTags: false,
  });
});

test('가격 없는 글은 판매 카테고리로 바꿀 수 없다', () => {
  const result = getPostCategoryModerationResult({
    currentCategory: { id: 'category-1', name: '자유', type: CategoryType.GENERAL },
    nextCategory: { id: 'category-2', name: '중고거래', type: CategoryType.SALE },
    hasPrice: false,
  });

  assert.deepEqual(result, {
    ok: false,
    message: '가격이 없는 글은 판매 카테고리로 변경할 수 없습니다. 먼저 글을 수정해 가격을 입력해 주세요.',
  });
});

test('판매 카테고리에서 일반 카테고리로 바꾸면 가격과 태그를 정리한다', () => {
  const result = getPostCategoryModerationResult({
    currentCategory: { id: 'category-1', name: '중고거래', type: CategoryType.SALE },
    nextCategory: { id: 'category-2', name: '자유', type: CategoryType.GENERAL },
    hasPrice: true,
  });

  assert.deepEqual(result, {
    ok: true,
    noop: false,
    clearPrice: true,
    clearTags: true,
  });
});

test('같은 타입 안에서 카테고리를 바꾸면 가격과 태그를 유지한다', () => {
  const result = getPostCategoryModerationResult({
    currentCategory: { id: 'category-1', name: '중고거래', type: CategoryType.SALE },
    nextCategory: { id: 'category-2', name: '나눔', type: CategoryType.SALE },
    hasPrice: true,
  });

  assert.deepEqual(result, {
    ok: true,
    noop: false,
    clearPrice: false,
    clearTags: false,
  });
});
