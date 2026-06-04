import { CategoryType } from '@prisma/client';

type CategorySnapshot = {
  id: string;
  name: string;
  type: CategoryType;
};

type PostCategoryModerationInput = {
  currentCategory: CategorySnapshot;
  nextCategory: CategorySnapshot;
  hasPrice: boolean;
};

type PostCategoryModerationResult =
  | {
      ok: true;
      noop: boolean;
      clearPrice: boolean;
      clearTags: boolean;
    }
  | {
      ok: false;
      message: string;
    };

export function getPostCategoryModerationResult(
  input: PostCategoryModerationInput,
): PostCategoryModerationResult {
  const { currentCategory, nextCategory, hasPrice } = input;

  if (currentCategory.id === nextCategory.id) {
    return {
      ok: true,
      noop: true,
      clearPrice: false,
      clearTags: false,
    };
  }

  if (nextCategory.type === CategoryType.SALE && !hasPrice) {
    return {
      ok: false,
      message: '가격이 없는 글은 판매 카테고리로 변경할 수 없습니다. 먼저 글을 수정해 가격을 입력해 주세요.',
    };
  }

  return {
    ok: true,
    noop: false,
    clearPrice: nextCategory.type !== CategoryType.SALE,
    clearTags: currentCategory.type !== nextCategory.type,
  };
}
