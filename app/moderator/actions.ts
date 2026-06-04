'use server';

import { ReportReviewStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { retryKakaoMessageDelivery } from '@/lib/kakao/message';
import {
  canModerate,
  canRestorePost,
  canDeleteComment,
  canModerateUser,
  canMakeFinalUserDecision,
} from '@/lib/permissions';
import { getPostCategoryModerationResult } from '@/lib/posts/post-category-moderation';
import {
  applyCommunityScoreChange,
} from '@/lib/community-score';
import { applyUserWarmthDelta } from '@/lib/neighbour-warmth/update';
import { createNotification } from '@/lib/notifications';

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeReportFilter(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  return normalized === 'resolved' || normalized === 'all' ? normalized : 'pending';
}

function redirectWithQuery(path: string, query: Record<string, string>): never {
  const searchParams = new URLSearchParams(query);
  redirect(`${path}?${searchParams.toString()}`);
}

function parseReviewStatus(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  if (normalized === ReportReviewStatus.VALID || normalized === ReportReviewStatus.FALSE_REPORT) {
    return normalized;
  }

  return null;
}

async function logModerationAction(
  actorId: string,
  targetType: string,
  targetId: string,
  actionType: string,
  reason?: string,
) {
  await prisma.moderationAction.create({
    data: {
      actorId,
      targetType,
      targetId,
      actionType,
      reason: reason || null,
    },
  });
}

export async function holdPostAction(formData: FormData) {
  const user = await requireUser();

  if (!canModerate(user)) {
    redirect('/moderator?error=권한이 없습니다.');
  }

  const postId = normalizeText(formData.get('postId'));
  const reason = normalizeText(formData.get('reason'));

  if (!postId) {
    redirect('/moderator?error=게시글 ID가 없습니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, authorId: true },
  });

  if (!post || post.status === 'DELETED') {
    redirect('/moderator?error=게시글을 찾을 수 없습니다.');
  }

  if (post.status === 'HELD') {
    redirect('/moderator?error=이미 보류된 게시글입니다.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: 'HELD',
        isPinned: false,
        pinnedAt: null,
        heldAt: new Date(),
        heldReason: reason || null,
      },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'HOLD',
        reason: reason || null,
      },
    });
  });

  void applyUserWarmthDelta(post.authorId, 'COORDINATOR_HOLDS').catch(
    (err) => {
      console.error('[holdPostAction] neighbour warmth update failed', err);
    },
  );

  void applyCommunityScoreChange({
    targetType: 'POST',
    targetId: postId,
    actorId: user.id,
    reason: 'COORDINATOR_HOLDS',
  }).catch((err) => {
    console.error('[holdPostAction] community score update failed', err);
  });

  void createNotification({
    recipientId: post.authorId,
    type: 'POST_HELD',
    relatedPostId: postId,
  }).catch((err) => {
    console.error('[holdPostAction] notification creation failed', err);
  });

  revalidatePath('/moderator');
  revalidatePath('/admin/posts');
  revalidatePath('/posts');
  revalidatePath(`/posts/${postId}`);
  redirect('/moderator');
}

export async function restorePostAction(formData: FormData) {
  const user = await requireUser();

  if (!canRestorePost(user)) {
    redirect('/moderator?error=권한이 없습니다.');
  }

  const postId = normalizeText(formData.get('postId'));
  const reason = normalizeText(formData.get('reason'));

  if (!postId) {
    redirect('/moderator?error=게시글 ID가 없습니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });

  if (!post) {
    redirect('/moderator?error=게시글을 찾을 수 없습니다.');
  }

  if (post.status !== 'HELD') {
    redirect('/moderator?error=보류 상태인 게시글만 복구할 수 있습니다.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        // Intentionally keep restored posts unpinned after any HELD/DELETED transition.
        isPinned: false,
        pinnedAt: null,
        heldAt: null,
        heldReason: null,
      },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'RESTORE',
        reason: reason || null,
      },
    });
  });

  void applyCommunityScoreChange({
    targetType: 'POST',
    targetId: postId,
    actorId: user.id,
    reason: 'COORDINATOR_RESTORES',
  }).catch((err) => {
    console.error('[restorePostAction] community score update failed', err);
  });

  revalidatePath('/moderator');
  revalidatePath('/admin/posts');
  revalidatePath('/posts');
  revalidatePath(`/posts/${postId}`);
  redirect('/moderator');
}

export async function changePostCategoryAction(formData: FormData) {
  const user = await requireUser();

  if (!canModerate(user)) {
    redirect('/moderator?error=권한이 없습니다.');
  }

  const postId = normalizeText(formData.get('postId'));
  const categoryId = normalizeText(formData.get('categoryId'));

  if (!postId || !categoryId) {
    redirect('/moderator?error=게시글 또는 카테고리 정보가 없습니다.');
  }

  const [post, nextCategory] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        price: true,
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    }),
    prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
  ]);

  if (!post) {
    redirect('/moderator?error=게시글을 찾을 수 없습니다.');
  }

  if (!nextCategory) {
    redirect('/moderator?error=변경할 카테고리를 찾을 수 없습니다.');
  }

  const changeResult = getPostCategoryModerationResult({
    currentCategory: post.category,
    nextCategory,
    hasPrice: post.price !== null,
  });

  if (!changeResult.ok) {
    redirect(`/moderator?error=${encodeURIComponent(changeResult.message)}`);
  }

  if (changeResult.noop) {
    redirect(`/moderator?success=${encodeURIComponent('이미 해당 카테고리로 설정된 글입니다.')}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        categoryId: nextCategory.id,
        price: changeResult.clearPrice ? null : undefined,
      },
    });

    if (changeResult.clearTags) {
      await tx.postTag.deleteMany({
        where: { postId },
      });
    }

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'CHANGE_CATEGORY',
        reason: JSON.stringify({
          fromCategoryId: post.category.id,
          fromCategoryName: post.category.name,
          fromCategoryType: post.category.type,
          toCategoryId: nextCategory.id,
          toCategoryName: nextCategory.name,
          toCategoryType: nextCategory.type,
          clearedPrice: changeResult.clearPrice,
          clearedTags: changeResult.clearTags,
        }),
      },
    });
  });

  revalidatePath('/admin/posts');
  revalidatePath('/moderator');
  revalidatePath('/posts');
  revalidatePath('/my/posts');
  revalidatePath(`/posts/${postId}`);
  redirect(`/moderator?success=${encodeURIComponent('게시글 카테고리를 변경했어요.')}`);
}

export async function holdCommentAction(formData: FormData) {
  const user = await requireUser();

  const postId = normalizeText(formData.get('postId'));
  const commentId = normalizeText(formData.get('commentId'));
  const reason = normalizeText(formData.get('reason'));

  if (!postId || !commentId) {
    redirect('/moderator?error=댓글 정보가 없습니다.');
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true, status: true },
  });

  if (!comment || comment.postId !== postId || !canDeleteComment(user, comment)) {
    redirect('/moderator?error=권한이 없습니다.');
  }

  if (comment.status === 'HELD') {
    redirect('/moderator?error=이미 보류된 댓글입니다.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: commentId },
      data: { status: 'HELD' },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'COMMENT',
        targetId: commentId,
        actionType: 'HOLD',
        reason: reason || null,
      },
    });
  });

  void applyUserWarmthDelta(comment.authorId, 'COORDINATOR_HOLDS').catch(
    (err) => {
      console.error('[holdCommentAction] neighbour warmth update failed', err);
    },
  );

  void applyCommunityScoreChange({
    targetType: 'COMMENT',
    targetId: commentId,
    actorId: user.id,
    reason: 'COORDINATOR_HOLDS',
  }).catch((err) => {
    console.error('[holdCommentAction] community score update failed', err);
  });

  void createNotification({
    recipientId: comment.authorId,
    type: 'COMMENT_HELD',
    relatedPostId: postId,
    relatedCommentId: commentId,
  }).catch((err) => {
    console.error('[holdCommentAction] notification creation failed', err);
  });

  revalidatePath('/moderator');
  revalidatePath(`/posts/${postId}`);
}

export async function restoreCommentAction(formData: FormData) {
  const user = await requireUser();

  const postId = normalizeText(formData.get('postId'));
  const commentId = normalizeText(formData.get('commentId'));

  if (!postId || !commentId) {
    redirectWithQuery('/moderator/reports', { error: '댓글 정보가 없습니다.' });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true, status: true },
  });

  if (!comment) {
    redirectWithQuery('/moderator/reports', { error: '권한이 없습니다.' });
  }

  if (comment.postId !== postId || !canDeleteComment(user, comment)) {
    redirectWithQuery('/moderator/reports', { error: '권한이 없습니다.' });
  }

  if (comment.status !== 'HELD') {
    redirectWithQuery('/moderator/reports', {
      error: '보류 상태인 댓글만 복구할 수 있습니다.',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: commentId },
      data: { status: 'PUBLISHED' },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'COMMENT',
        targetId: commentId,
        actionType: 'RESTORE',
      },
    });
  });

  void applyCommunityScoreChange({
    targetType: 'COMMENT',
    targetId: commentId,
    actorId: user.id,
    reason: 'COORDINATOR_RESTORES',
  }).catch((err) => {
    console.error('[restoreCommentAction] community score update failed', err);
  });

  revalidatePath('/moderator/reports');
  revalidatePath(`/posts/${postId}`);
}

export async function reviewPostReportAction(formData: FormData) {
  const user = await requireUser();

  if (!canModerate(user)) {
    redirectWithQuery('/moderator/reports', { error: '권한이 없습니다.' });
  }

  const reportId = normalizeText(formData.get('reportId'));
  const reviewStatus = parseReviewStatus(formData.get('reviewStatus'));
  const filter = normalizeReportFilter(formData.get('filter'));

  if (!reportId) {
    redirectWithQuery('/moderator/reports', {
      filter,
      error: '신고 ID가 없습니다.',
    });
  }

  if (!reviewStatus) {
    redirectWithQuery('/moderator/reports', {
      filter,
      error: '유효한 확정 상태를 선택해 주세요.',
    });
  }

  const resolvedReviewStatus = reviewStatus;

  const report = await prisma.postReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      postId: true,
      reporterId: true,
      reviewStatus: true,
      post: {
        select: { authorId: true },
      },
    },
  });

  if (!report) {
    redirectWithQuery('/moderator/reports', {
      filter,
      error: '신고 내역을 찾을 수 없습니다.',
    });
  }

  const resolvedReport = report;

  await prisma.postReport.update({
    where: { id: reportId },
    data: {
      reviewStatus: resolvedReviewStatus,
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });

  await logModerationAction(
    user.id,
    'POST_REPORT',
    reportId,
    resolvedReviewStatus === ReportReviewStatus.VALID ? 'REPORT_VALIDATED' : 'REPORT_MARKED_FALSE',
  );

  if (resolvedReport.reviewStatus === ReportReviewStatus.PENDING) {
    if (resolvedReviewStatus === ReportReviewStatus.VALID) {
      void applyUserWarmthDelta(
        resolvedReport.post.authorId,
        'VALID_POST_REPORT',
      ).catch(
        (err) => {
          console.error('[reviewPostReportAction] neighbour warmth update failed', err);
        },
      );
    } else if (resolvedReviewStatus === ReportReviewStatus.FALSE_REPORT) {
      void applyUserWarmthDelta(
        resolvedReport.reporterId,
        'FALSE_REPORT',
      ).catch(
        (err) => {
          console.error('[reviewPostReportAction] neighbour warmth update failed', err);
        },
      );
    }
  }

  revalidatePath('/moderator');
  revalidatePath('/moderator/reports');
  redirectWithQuery('/moderator/reports', {
    filter,
    success: '신고 상태를 저장했어요.',
  });
}

export async function reviewCommentReportAction(formData: FormData) {
  const user = await requireUser();

  if (!canModerate(user)) {
    redirectWithQuery('/moderator/reports', { error: '권한이 없습니다.' });
  }

  const reportId = normalizeText(formData.get('reportId'));
  const reviewStatus = parseReviewStatus(formData.get('reviewStatus'));
  const filter = normalizeReportFilter(formData.get('filter'));

  if (!reportId) {
    redirectWithQuery('/moderator/reports', {
      filter,
      error: '신고 ID가 없습니다.',
    });
  }

  if (!reviewStatus) {
    redirectWithQuery('/moderator/reports', {
      filter,
      error: '유효한 확정 상태를 선택해 주세요.',
    });
  }

  const resolvedReviewStatus = reviewStatus;

  const report = await prisma.commentReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      reporterId: true,
      reviewStatus: true,
      comment: {
        select: { authorId: true },
      },
    },
  });

  if (!report) {
    redirectWithQuery('/moderator/reports', {
      filter,
      error: '신고 내역을 찾을 수 없습니다.',
    });
  }

  const resolvedReport = report;

  await prisma.commentReport.update({
    where: { id: reportId },
    data: {
      reviewStatus: resolvedReviewStatus,
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });

  await logModerationAction(
    user.id,
    'COMMENT_REPORT',
    reportId,
    resolvedReviewStatus === ReportReviewStatus.VALID ? 'REPORT_VALIDATED' : 'REPORT_MARKED_FALSE',
  );

  if (resolvedReport.reviewStatus === ReportReviewStatus.PENDING) {
    if (resolvedReviewStatus === ReportReviewStatus.VALID) {
      void applyUserWarmthDelta(
        resolvedReport.comment.authorId,
        'VALID_COMMENT_REPORT',
      ).catch((err) => {
        console.error('[reviewCommentReportAction] neighbour warmth update failed', err);
      });
    } else if (resolvedReviewStatus === ReportReviewStatus.FALSE_REPORT) {
      void applyUserWarmthDelta(
        resolvedReport.reporterId,
        'FALSE_REPORT',
      ).catch((err) => {
        console.error('[reviewCommentReportAction] neighbour warmth update failed', err);
      });
    }
  }

  revalidatePath('/moderator');
  revalidatePath('/moderator/reports');
  redirectWithQuery('/moderator/reports', {
    filter,
    success: '신고 상태를 저장했어요.',
  });
}

export async function requestUserReviewAction(formData: FormData) {
  const user = await requireUser();

  if (!canModerateUser(user)) {
    redirect('/moderator?error=권한이 없습니다.');
  }

  const targetUserId = normalizeText(formData.get('targetUserId'));
  const reason = normalizeText(formData.get('reason'));

  if (!targetUserId) {
    redirect('/moderator?error=사용자 ID가 없습니다.');
  }

  // Server-side validation mirrors the client `required` attribute to prevent
  // bypassed requests (e.g. direct form submission without browser enforcement).
  if (!reason) {
    redirect('/moderator?error=검토 사유를 입력해 주세요.');
  }

  const targetUser = await prisma.user
    .findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        status: true,
        countryId: true,
        cityId: true,
        staffAssignments: {
          where: { isActive: true },
          select: { id: true, role: true, countryId: true, cityId: true },
        },
      },
    });

  if (!targetUser) {
    redirect('/moderator?error=사용자를 찾을 수 없습니다.');
  }

  if (canMakeFinalUserDecision(targetUser)) {
    redirect('/moderator?error=관리자에 대한 검토 요청은 불가합니다.');
  }

  await logModerationAction(user.id, 'USER', targetUserId, 'REVIEW_REQUEST', reason);

  revalidatePath('/moderator');
  redirect('/moderator');
}

export async function retryKakaoMessageDeliveryAction(formData: FormData) {
  const user = await requireUser();

  if (!canModerate(user)) {
    redirect('/moderator/kakao-messages?error=권한이 없습니다.');
  }

  const deliveryId = normalizeText(formData.get('deliveryId'));

  if (!deliveryId) {
    redirect('/moderator/kakao-messages?error=카카오 전송 로그 ID가 없습니다.');
  }

  const result = await retryKakaoMessageDelivery(deliveryId, user.id);

  revalidatePath('/moderator/kakao-messages');
  if (!result.ok) {
    redirect(`/moderator/kakao-messages?error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/moderator/kakao-messages?success=${encodeURIComponent(result.message)}`);
}
