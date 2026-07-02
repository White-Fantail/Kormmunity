import { cache, Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { CategoryType } from '@prisma/client';
import { notFound } from 'next/navigation';

import {
  togglePostLikeAction,
  reportPostAction,
} from '@/app/posts/actions';
import { savePostAction, unsavePostAction } from '@/app/posts/saved-actions';
import {
  deleteCommentAction,
  toggleCommentLikeAction,
  setBestCommentAction,
  removeBestCommentAction,
  reportCommentAction,
} from '@/app/posts/[postId]/comments/actions';
import {
  holdPostAction,
  restorePostAction,
  holdCommentAction,
  restoreCommentAction,
} from '@/app/moderator/actions';
import { DeletePostButton } from '@/components/posts/delete-post-button';
import {
  BookmarkIcon,
  CommentActionButtons,
  CommentIcon,
  HeartIcon,
  IconActionButton,
  IconActionLink,
  PostActionButtons,
} from '@/components/posts/action-buttons';
import {
  PostCommentComposer,
  PostContactAction,
  PostEngagementProvider,
} from '@/components/posts/post-engagement';
import { PostImageGallery } from '@/components/posts/post-image-gallery';
import { PostTagBadge } from '@/components/posts/post-tag-badge';
import { PostShareButton } from '@/components/posts/post-share-button';
import { PostMarkdown } from '@/components/posts/post-markdown';
import { PostViewTracker } from '@/components/posts/post-view-tracker';
import { ScoreLogViewer } from '@/components/moderation/score-log-viewer';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { DateTimeText } from '@/components/ui/date-time-text';
import { NeighbourWarmthLabel } from '@/components/ui/neighbour-warmth-label';
import { OverflowMenu, overflowMenuItemClassName } from '@/components/ui/overflow-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  canDeleteComment,
  canDeletePost,
  canEditPost,
  canModerate,
  canReportPost,
  canReportComment,
  canUseAutoContentGeneration,
  canUseContactFeature,
  isAdmin,
} from '@/lib/permissions';
import {
  getActiveCategories,
  getActiveCities,
  getActiveCitiesByCountry,
  getActivePostTagOptions,
} from '@/lib/posts/reference-data';
import { truncatePostBody } from '@/lib/posts/constants';
import { getCategoryDisplayName } from '@/lib/posts/category-display';
import { decodeCursor, encodeCursor } from '@/lib/posts/cursor';
import { buildPinnedPostCursorWhere, PINNED_POST_ORDER_ASC, PINNED_POST_ORDER_DESC } from '@/lib/posts/pinned-order';
import { measureServerTiming } from '@/lib/performance/server';
import { shouldShowOperatorBadge, shouldShowWarmth } from '@/lib/account-type';
import {
  canSelectAuthorAccount,
  getAuthorAccountOptionsForActor,
} from '@/lib/posts/author-account-options';


const TITLE_PREVIEW_LENGTH = 40;
const DESCRIPTION_PREVIEW_LENGTH = 80;
const COMMUNITY_NAME = '한인 커뮤니티';
const TWITTER_CARD_SUMMARY = 'summary';
const TWITTER_CARD_LARGE_IMAGE = 'summary_large_image';

type PostDetailPageProps = {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    category?: string | string[];
    city?: string | string[];
    type?: string | string[];
    tag?: string | string[];
    q?: string | string[];
    cursor?: string | string[];
    direction?: string | string[];
    commentsCursor?: string | string[];
    commentsDirection?: string | string[];
  }>;
};

function toArray(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toSingle(value: string | string[] | undefined) {
  if (!value) {
    return '';
  }

  return (Array.isArray(value) ? value[0] : value).trim();
}

const getPostWithDetails = cache(async (postId: string) => {
  return measureServerTiming('post-detail:base', () =>
    prisma.post.findUnique({
      where: { id: postId },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              profileImageUrl: true,
              openChatUrl: true,
              neighbourWarmth: true,
              accountType: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              displayName: true,
            },
          },
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            quickCommentTemplates: true,
          },
        },
        tags: {
          select: {
            postTagOption: {
              select: { id: true, label: true, isActive: true },
            },
          },
        },
        city: { select: { name: true } },
        images: {
          select: { id: true, url: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            comments: {
              where: { status: 'PUBLISHED' },
            },
            postLikes: true,
          },
        },
      },
    }),
  );
});

const COMMENT_PAGE_SIZE = 20;

const getPostComments = cache(async (
  postId: string,
  cursorToken: string,
  direction: 'next' | 'prev',
  currentUserId: string | null,
  includeHeld: boolean,
) => {
  const cursor = cursorToken ? decodeCursor(cursorToken) : null;
  const statusFilter: { in: ('PUBLISHED' | 'HELD')[] } | { equals: 'PUBLISHED' } = includeHeld
    ? { in: ['PUBLISHED', 'HELD'] }
    : { equals: 'PUBLISHED' };
  const comments = await measureServerTiming('post-detail:comments', () =>
    prisma.comment.findMany({
      where: {
        postId,
        status: statusFilter,
        ...(cursor
          ? direction === 'prev'
            ? {
                OR: [
                  { createdAt: { gt: cursor.createdAt } },
                  { AND: [{ createdAt: cursor.createdAt }, { id: { gt: cursor.id } }] },
                ],
              }
            : {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
                ],
              }
          : {}),
      },
      orderBy:
        direction === 'prev'
          ? [{ createdAt: 'asc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: COMMENT_PAGE_SIZE + 1,
      select: {
        id: true,
        body: true,
        authorId: true,
        status: true,
        createdAt: true,
        author: {
          select: {
            displayName: true,
            profileImageUrl: true,
            neighbourWarmth: true,
            accountType: true,
          },
        },
        createdByUserId: true,
        commentLikes: {
          where: { userId: currentUserId ?? '__anonymous__' },
          select: { id: true },
          take: 1,
        },
        _count: {
          select: {
            commentLikes: true,
          },
        },
      },
    }),
  );
  const hasExtra = comments.length > COMMENT_PAGE_SIZE;
  const slicedComments = hasExtra ? comments.slice(0, COMMENT_PAGE_SIZE) : comments;
  const visibleComments = direction === 'prev' ? [...slicedComments].reverse() : slicedComments;

  return {
    visibleComments,
    hasPrevPage: direction === 'prev' ? hasExtra : Boolean(cursor),
    hasNextPage: direction === 'prev' ? Boolean(cursor) : hasExtra,
  };
});

export async function generateMetadata({
  params,
}: Pick<PostDetailPageProps, 'params'>): Promise<Metadata> {
  const { postId } = await params;

  const post = await getPostWithDetails(postId);

  if (!post || post.status === 'DELETED') {
    return {
      title: '게시글을 찾을 수 없어요',
      robots: { index: false, follow: false },
    };
  }

  const title = post.title ?? post.body.slice(0, TITLE_PREVIEW_LENGTH);
  const socialTitle = `${title} | ${COMMUNITY_NAME}`;
  const description = `${getCategoryDisplayName(post.category)} · ${post.city?.name ?? '전 지역'} · ${post.body.slice(0, DESCRIPTION_PREVIEW_LENGTH)}`;
  const primaryImageUrl = post.images?.[0]?.url;
  const twitterCard = primaryImageUrl ? TWITTER_CARD_LARGE_IMAGE : TWITTER_CARD_SUMMARY;

  return {
    title,
    description,
    openGraph: {
      title: socialTitle,
      description,
      type: 'article',
      images: primaryImageUrl ? [primaryImageUrl] : undefined,
    },
    twitter: {
      card: twitterCard,
      title: socialTitle,
      description,
      images: primaryImageUrl ? [primaryImageUrl] : undefined,
    },
  };
}

export default async function PostDetailPage({
  params,
  searchParams,
}: PostDetailPageProps) {
  const { postId } = await params;
  const query = await searchParams;
  const currentUser = await getCurrentUser();

  const post = await getPostWithDetails(postId);

  if (!post || post.status === 'DELETED') {
    notFound();
  }

  const canModerateContent = currentUser ? canModerate(currentUser) : false;
  const isAdminUser = isAdmin(currentUser);

  const displayAuthorName = post.author.displayName;
  const displayAuthorImageUrl: string | null = post.author.profileImageUrl;
  const isOperatorPost = shouldShowOperatorBadge(post.author);

  // Non-moderators see a pending-review message for HELD posts
  if (post.status === 'HELD' && !canModerateContent) {
    return (
      <article className="space-y-4 rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
        <div className="rounded-lg border border-yellow-200 bg-[#fffde7] px-4 py-6 text-center">
          <p className="text-base font-medium text-[#7a6000]">
            이 게시글은 신고 접수로 인해 운영 검토 중입니다.
          </p>
        </div>
      </article>
    );
  }

  const contactUrl = canUseContactFeature(currentUser)
    ? (post.contactUrl ?? post.author.openChatUrl)
    : null;
  const canSubmitReport = currentUser ? canReportPost(currentUser, post) : false;
  const canSubmitCommentReport = currentUser
    ? currentUser.status === 'ACTIVE'
    : false;
  let reportOptions: { id: string; label: string }[] = [];
  let myReport: { optionId: string; additionalReason: string | null } | null = null;
  let isSaved = false;
  let isPostLiked = false;
  const postContextParams = new URLSearchParams();
  for (const categoryId of toArray(query.category)) {
    if (categoryId.trim()) {
      postContextParams.append('category', categoryId.trim());
    }
  }
  for (const cityId of toArray(query.city)) {
    if (cityId.trim()) {
      postContextParams.append('city', cityId.trim());
    }
  }
  for (const categoryType of toArray(query.type)) {
    if (categoryType.trim()) {
      postContextParams.append('type', categoryType.trim());
    }
  }
  for (const tagId of toArray(query.tag)) {
    if (tagId.trim()) {
      postContextParams.append('tag', tagId.trim());
    }
  }
  const keyword = toSingle(query.q);
  if (keyword) {
    postContextParams.set('q', keyword);
  }
  const listCursor = toSingle(query.cursor);
  if (listCursor) {
    postContextParams.set('cursor', listCursor);
  }
  const listDirection = toSingle(query.direction);
  if (listDirection === 'prev') {
    postContextParams.set('direction', listDirection);
  }
  const postContextQueryString = postContextParams.toString();
  const createPostHref = (targetPostId: string) =>
    `/posts/${targetPostId}${postContextQueryString ? `?${postContextQueryString}` : ''}`;
  const currentPostHref = createPostHref(post.id);

  if (currentUser) {
    const savedPostPromise = prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId: currentUser.id,
          postId: post.id,
        },
      },
      select: { id: true },
    });
    const postLikePromise = prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: currentUser.id,
        },
      },
      select: { id: true },
    });

    if (canSubmitReport || canSubmitCommentReport) {
      const [savedPost, likedPost, options, report] = await Promise.all([
        savedPostPromise,
        postLikePromise,
        prisma.reportOption.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, label: true },
        }),
        canSubmitReport
          ? prisma.postReport.findUnique({
              where: {
                postId_reporterId: {
                  postId: post.id,
                  reporterId: currentUser.id,
                },
              },
              select: { optionId: true, additionalReason: true },
            })
          : Promise.resolve(null),
      ]);

      isSaved = Boolean(savedPost);
      isPostLiked = Boolean(likedPost);
      reportOptions = options;
      myReport = report;
    } else {
      const [savedPost, likedPost] = await Promise.all([savedPostPromise, postLikePromise]);
      isSaved = Boolean(savedPost);
      isPostLiked = Boolean(likedPost);
    }
  }

  const isOwner = currentUser?.id === post.authorId;
  const canBypassCommentGate = currentUser ? canModerate(currentUser) : false;
  const hasValidCommentForContact =
    currentUser && !isOwner && post.requireCommentBeforeContact && !canBypassCommentGate
      ? Boolean(
          await prisma.comment.findFirst({
            where: {
              postId: post.id,
              authorId: currentUser.id,
              status: 'PUBLISHED',
            },
            select: { id: true },
          }),
        )
      : false;
  const quickCommentTemplates = Array.isArray(post.category.quickCommentTemplates)
    ? post.category.quickCommentTemplates.filter(
        (template): template is string =>
          typeof template === 'string' && template.trim().length > 0,
      )
    : [];
  const hasReportOptions = canSubmitReport && reportOptions.length > 0;
  const canEditCurrentPost = canEditPost(currentUser, post);
  const canDeleteCurrentPost = canDeletePost(currentUser, post);
  const canModerateCurrentPost = currentUser ? canModerate(currentUser) : false;
  const canShowPostOverflowMenu =
    (hasReportOptions || canEditCurrentPost || canDeleteCurrentPost || canModerateCurrentPost);
  const compactPostOverflowPanelClassName = 'w-40';
  const widePostOverflowPanelClassName = 'w-72';
  const postOverflowPanelClassName =
    hasReportOptions || canModerateCurrentPost
      ? widePostOverflowPanelClassName
      : compactPostOverflowPanelClassName;
  const outlineActionButtonClass =
    'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#e8e8e8] px-4 py-2 text-sm font-medium hover:bg-[#f9f9f9]';
  const primaryActionButtonClass =
    'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] px-4 py-2 text-sm font-bold text-[#3c1e1e] hover:bg-[#f5db00]';

  return (
    <article className="relative space-y-4 rounded-xl border border-[#e8e8e8] bg-white p-4 sm:pr-12 shadow-sm">
      <PostViewTracker postId={post.id} />
      {query.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{query.error}</p>
      ) : null}
      {query.success ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{query.success}</p>
      ) : null}
      {canShowPostOverflowMenu ? (
        <div className="absolute right-3 top-3 z-20">
          <OverflowMenu panelClassName={postOverflowPanelClassName}>
            {hasReportOptions ? (
              <details className="group/report rounded-lg">
                <summary className={`${overflowMenuItemClassName} flex cursor-pointer list-none items-center justify-between`}>
                  <span>신고하기</span>
                  <span className="text-xs text-[#999] transition group-open/report:rotate-180">▼</span>
                </summary>
                <div className="mt-2 space-y-2 border-t border-[#f0f0f0] px-1 pt-2">
                  {myReport ? (
                    <p className="text-xs text-[#888]">
                      이미 신고한 글입니다. 다시 제출하면 신고 내용이 업데이트됩니다.
                    </p>
                  ) : null}
                  <form action={reportPostAction} className="space-y-2">
                    <input type="hidden" name="postId" value={post.id} />
                    <label htmlFor="report-option" className="text-xs text-[#555]">
                      신고 사유
                    </label>
                    <select
                      id="report-option"
                      name="optionId"
                      defaultValue={myReport?.optionId ?? ''}
                      required
                      className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
                    >
                      <option value="" disabled>
                        신고 사유를 선택해 주세요
                      </option>
                      {reportOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="report-additional-reason" className="text-xs text-[#555]">
                      추가 사유 (선택)
                    </label>
                    <textarea
                      id="report-additional-reason"
                      name="additionalReason"
                      rows={3}
                      maxLength={500}
                      defaultValue={myReport?.additionalReason ?? ''}
                      placeholder="옵션 외 추가로 설명할 내용이 있다면 입력해 주세요."
                      className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
                    />
                    <FormSubmitButton
                      idleLabel={myReport ? '신고 내용 수정' : '신고 접수'}
                      pendingLabel="접수 중..."
                      className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm font-medium text-[#444] hover:bg-[#f7f7f7]"
                    />
                  </form>
                </div>
              </details>
            ) : null}
            {canEditCurrentPost ? (
              <Link href={`/posts/${post.id}/edit`} className={overflowMenuItemClassName}>
                수정하기
              </Link>
            ) : null}
            {canModerateCurrentPost && post.status === 'PUBLISHED' ? (
              <details className="group/hold rounded-lg">
                <summary className={`${overflowMenuItemClassName} flex cursor-pointer list-none items-center justify-between`}>
                  <span>보류 처리</span>
                  <span className="text-xs text-[#999] transition group-open/hold:rotate-180">▼</span>
                </summary>
                <form action={holdPostAction} className="mt-2 space-y-2 border-t border-[#f0f0f0] px-1 pt-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="보류 사유 (선택)"
                    className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
                  />
                  <FormSubmitButton
                    idleLabel="보류 확정"
                    pendingLabel="처리 중..."
                    className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm font-medium text-[#444] hover:bg-[#f7f7f7]"
                  />
                </form>
              </details>
            ) : null}
            {canModerateCurrentPost && post.status === 'HELD' ? (
                <form action={restorePostAction} className="w-full">
                <input type="hidden" name="postId" value={post.id} />
                <FormSubmitButton
                  idleLabel="재게시"
                  pendingLabel="처리 중..."
                  className={overflowMenuItemClassName}
                />
              </form>
            ) : null}
            {canDeleteCurrentPost ? (
              <DeletePostButton
                postId={post.id}
                className={`${overflowMenuItemClassName} text-red-600`}
              />
            ) : null}
          </OverflowMenu>
        </div>
      ) : null}

      {post.status === 'HELD' ? (
        <div className="rounded-lg border border-yellow-200 bg-[#fffde7] px-3 py-2 text-sm text-[#7a6000]">
          <span>이 게시글은 현재 보류 상태입니다.</span>
          {post.heldReason ? <span> 사유: {post.heldReason}</span> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        {post.isPinned ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">📌 고정</span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f5] px-2 py-1 text-[#555]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 fill-current">
            <path d="M12 2a7 7 0 0 0-7 7c0 4.98 6.15 12.36 6.41 12.67a.75.75 0 0 0 1.16 0C12.85 21.36 19 13.98 19 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
          </svg>
          {post.city?.name ?? '전 지역'}
        </span>
        <span className="rounded-full bg-[#fffde7] px-2 py-1 font-medium text-[#7a6000]">{getCategoryDisplayName(post.category)}</span>
        {post.tags.map((tag) => (
          <PostTagBadge
            key={tag.postTagOption.id}
            label={tag.postTagOption.label}
            categoryColor={post.category.color}
          />
        ))}
      </div>

      {post.title ? (
        <h1 className="text-xl font-bold">{post.title}</h1>
      ) : null}

      {post.price ? (
        <div className="inline-flex items-baseline gap-1.5 rounded-xl bg-[#3c1e1e] px-4 py-2 shadow-sm">
          <span className="text-xs font-semibold tracking-wide text-[#f5d9a8] uppercase">NZD</span>
          <span className="text-2xl font-bold text-white">{post.price.toString()}</span>
        </div>
      ) : null}

      <PostMarkdown body={post.body} />

      {post.images.length > 0 ? (
        <PostImageGallery images={post.images} postTitle={post.title} />
      ) : null}

      <div className="flex items-center gap-2 text-sm text-[#888]">
        <UserAvatar
          displayName={displayAuthorName}
          profileImageUrl={displayAuthorImageUrl}
          className="h-7 w-7"
          sizes="28px"
        />
        <span>
          작성자:{' '}
          {isOperatorPost ? (
            <span className="font-medium text-[#3c1e1e]">
              {displayAuthorName}
              <span className="ml-1 rounded bg-[#3c1e1e] px-1 py-0.5 text-[10px] font-bold text-white">운영자</span>
            </span>
          ) : (
            <Link href={`/users/${post.author.id}`} className="font-medium text-[#3c1e1e] hover:underline">
              {displayAuthorName}
            </Link>
          )}
          {shouldShowWarmth(post.author) && (
            <>{' '}· <NeighbourWarmthLabel warmth={post.author.neighbourWarmth} /></>
          )}
          {' '}· 조회 {post.viewCount}
          {' '}· <DateTimeText value={post.createdAt} />
        </span>
      </div>
      {isAdminUser && post.createdByUser && post.createdByUser.id !== post.author.id && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">[관리자 확인]</span> 실제 작성자:{' '}
          <Link href={`/users/${post.createdByUser.id}`} className="font-medium underline">
            {post.createdByUser.displayName}
          </Link>
        </div>
      )}

      <PostActionButtons>
        {currentUser ? (
          <form action={togglePostLikeAction}>
            <input type="hidden" name="postId" value={post.id} />
            <IconActionButton
              type="submit"
              icon={<HeartIcon filled={isPostLiked} />}
              count={post._count.postLikes}
              tone="like"
              active={isPostLiked}
              aria-label={isPostLiked ? '좋아요 취소' : '좋아요'}
              title={isPostLiked ? '좋아요 취소' : '좋아요'}
            />
          </form>
        ) : (
          <IconActionLink
            href="/login"
            icon={<HeartIcon />}
            count={post._count.postLikes}
            aria-label="좋아요"
            title="좋아요"
          />
        )}
        <IconActionLink
          href="#comments"
          icon={<CommentIcon />}
          count={post._count.comments}
          aria-label="댓글"
          title="댓글"
        />
        {currentUser ? (
          <form action={isSaved ? unsavePostAction : savePostAction}>
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="returnTo" value={currentPostHref} />
            <IconActionButton
              type="submit"
              icon={<BookmarkIcon filled={isSaved} />}
              tone="save"
              active={isSaved}
              aria-label={isSaved ? '저장 취소' : '저장'}
              title={isSaved ? '저장 취소' : '저장'}
            />
          </form>
        ) : (
          <IconActionLink
            href="/login"
            icon={<BookmarkIcon />}
            aria-label="저장"
            title="저장"
          />
        )}
        <PostShareButton title={post.title} body={post.body} />
      </PostActionButtons>

      {canModerateCurrentPost ? (
        <ScoreLogViewer postId={post.id} />
      ) : null}

      <PostEngagementProvider
        contactUrl={contactUrl}
        requireCommentBeforeContact={post.requireCommentBeforeContact}
        initialHasUnlockedContact={hasValidCommentForContact}
        isOwner={isOwner}
        bypassGate={canBypassCommentGate}
        quickCommentTemplates={quickCommentTemplates}
      >
        <PostContactAction
          contactUrl={contactUrl}
          primaryActionButtonClass={primaryActionButtonClass}
        />

        <Suspense
          fallback={(
            <section className="grid grid-cols-1 gap-2 border-t border-[#e8e8e8] pt-4 sm:grid-cols-2">
              <button type="button" disabled className={`${outlineActionButtonClass} text-[#888]`}>
                이전 글을 불러오는 중...
              </button>
              <button type="button" disabled className={`${outlineActionButtonClass} text-[#888]`}>
                다음 글을 불러오는 중...
              </button>
            </section>
          )}
        >
          <AdjacentPostsSection
            post={post}
            query={query}
            currentUser={currentUser}
            createPostHref={createPostHref}
            outlineActionButtonClass={outlineActionButtonClass}
          />
        </Suspense>

        <Suspense
          fallback={(
            <section className="space-y-3 border-t border-[#e8e8e8] pt-4">
              <h2 className="text-base font-bold">댓글 {post._count.comments}개</h2>
              <p className="text-sm text-[#888]">댓글을 불러오는 중...</p>
            </section>
          )}
        >
          <CommentsSection
            postId={post.id}
            postCountryId={post.countryId}
            postCityId={post.cityId}
            postAuthorId={post.authorId}
            bestCommentId={post.bestCommentId}
            commentCount={post._count.comments}
            currentUser={currentUser}
            reportOptions={reportOptions}
            canModerateComments={canModerateContent}
            query={query}
          />
        </Suspense>
      </PostEngagementProvider>
    </article>
  );
}

type AdjacentPostsSectionProps = {
  post: Awaited<ReturnType<typeof getPostWithDetails>>;
  query: Awaited<PostDetailPageProps['searchParams']>;
  currentUser: Awaited<ReturnType<typeof getCurrentUser>>;
  createPostHref: (targetPostId: string) => string;
  outlineActionButtonClass: string;
};

async function AdjacentPostsSection({
  post,
  query,
  currentUser,
  createPostHref,
  outlineActionButtonClass,
}: AdjacentPostsSectionProps) {
  if (!post) {
    return null;
  }

  let previousPost: {
    id: string;
    title: string | null;
    body: string;
    tags: { postTagOption: { label: string } }[];
  } | null = null;
  let nextPost: {
    id: string;
    title: string | null;
    body: string;
    tags: { postTagOption: { label: string } }[];
  } | null = null;

  if (post.status === 'PUBLISHED') {
    const userCountryId = currentUser?.countryId ?? null;
    const [categories, cities, allTagOptions] = await Promise.all([
      getActiveCategories(),
      userCountryId ? getActiveCitiesByCountry(userCountryId) : getActiveCities(),
      getActivePostTagOptions(),
    ]);
    const categoryTypes = Array.from(new Set(categories.map((category) => category.type)));
    const categoryTypeSet = new Set(categoryTypes);
    const alwaysIncludedCategories = categories.filter(
      (category) => category.visibilityMode === 'ALWAYS_INCLUDED',
    );
    const filterCategories = categories.filter((category) => category.visibilityMode === 'NORMAL');
    const filterCategoryIds = new Set(filterCategories.map((category) => category.id));
    const cityIds = new Set(cities.map((city) => city.id));
    const profileCityId = currentUser?.cityId ?? null;
    const activeProfileCityId = profileCityId && cityIds.has(profileCityId) ? profileCityId : null;
    const hasActiveProfileCity = activeProfileCityId !== null;
    const selectedFilterCategoryIdsFromParams = Array.from(
      new Set(toArray(query.category).filter((id) => filterCategoryIds.has(id))),
    );
    const selectedFilterCategoryIds =
      selectedFilterCategoryIdsFromParams.length > 0
        ? selectedFilterCategoryIdsFromParams
        : filterCategories.map((category) => category.id);
    const selectedFilterCategoryTypesFromParams = Array.from(
      new Set(
        toArray(query.type).filter(
          (type): type is CategoryType => categoryTypeSet.has(type as CategoryType),
        ),
      ),
    );
    const selectedFilterCategoryTypes =
      selectedFilterCategoryTypesFromParams.length > 0
        ? selectedFilterCategoryTypesFromParams
        : categoryTypes;
    const selectedCategoryIds = Array.from(
      new Set([
        ...selectedFilterCategoryIds,
        ...alwaysIncludedCategories.map((category) => category.id),
      ]),
    );
    const selectedCityIdsFromParams = Array.from(
      new Set(toArray(query.city).filter((id) => cityIds.has(id))),
    );
    const selectedCityIdsBase =
      selectedCityIdsFromParams.length > 0
        ? selectedCityIdsFromParams
        : cities.map((city) => city.id);
    const shouldIncludeProfileCity = hasActiveProfileCity
      ? !selectedCityIdsBase.includes(activeProfileCityId)
      : false;
    const selectedCityIds = shouldIncludeProfileCity
      ? [...selectedCityIdsBase, activeProfileCityId]
      : selectedCityIdsBase;
    const selectableTagOptions = allTagOptions.filter((option) =>
      selectedFilterCategoryTypes.includes(option.categoryType),
    );
    const selectableTagIds = new Set(selectableTagOptions.map((option) => option.id));
    const selectedTagIds = Array.from(
      new Set(toArray(query.tag).filter((id) => selectableTagIds.has(id))),
    );
    const keyword = toSingle(query.q);
    const shouldFilterByCountry = Boolean(userCountryId);
    const shouldFilterByCategoryType = selectedFilterCategoryTypes.length !== categoryTypes.length;
    const shouldFilterByTag = selectedTagIds.length > 0;
    const shouldFilterByCity = hasActiveProfileCity && selectedCityIds.length !== cities.length;
    const hasKeyword = Boolean(keyword);
    const andConditions: object[] = [];
    if (shouldFilterByCountry) {
      andConditions.push({ OR: [{ countryId: userCountryId }, { countryId: null }] });
    }
    if (shouldFilterByCity) {
      andConditions.push({ OR: [{ cityId: { in: selectedCityIds } }, { cityId: null }] });
    }
    if (shouldFilterByCategoryType) {
      andConditions.push({ category: { type: { in: selectedFilterCategoryTypes } } });
    }
    if (shouldFilterByTag) {
      andConditions.push({
        tags: {
          some: {
            postTagOptionId: {
              in: selectedTagIds,
            },
          },
        },
      });
    }
    if (hasKeyword) {
      andConditions.push({
        OR: [
          { title: { contains: keyword, mode: 'insensitive' as const } },
          { body: { contains: keyword, mode: 'insensitive' as const } },
          { author: { displayName: { contains: keyword, mode: 'insensitive' as const } } },
        ],
      });
    }

    const currentPostCursor = {
      id: post.id,
      createdAt: post.createdAt,
      isPinned: post.isPinned,
      pinnedAt: post.pinnedAt,
    };
    const previousCursorWhere = buildPinnedPostCursorWhere(currentPostCursor, 'prev');
    const nextCursorWhere = buildPinnedPostCursorWhere(currentPostCursor, 'next');

    [previousPost, nextPost] = await measureServerTiming('post-detail:adjacent', () =>
      Promise.all([
        prisma.post.findFirst({
          where: {
            status: 'PUBLISHED',
            categoryId: { in: selectedCategoryIds },
            AND: [
              ...andConditions,
              ...(previousCursorWhere ? [previousCursorWhere] : []),
            ],
          },
          orderBy: PINNED_POST_ORDER_ASC,
          select: {
            id: true,
            title: true,
            body: true,
            tags: {
              select: {
                postTagOption: {
                  select: { label: true },
                },
              },
              take: 1,
            },
          },
        }),
        prisma.post.findFirst({
          where: {
            status: 'PUBLISHED',
            categoryId: { in: selectedCategoryIds },
            AND: [
              ...andConditions,
              ...(nextCursorWhere ? [nextCursorWhere] : []),
            ],
          },
          orderBy: PINNED_POST_ORDER_DESC,
          select: {
            id: true,
            title: true,
            body: true,
            tags: {
              select: {
                postTagOption: {
                  select: { label: true },
                },
              },
              take: 1,
            },
          },
        }),
      ]),
    );
  }

  const getAdjacentPostPreviewText = (targetPost: { title: string | null; body: string }) => {
    const titleText = targetPost.title?.trim();
    if (titleText) {
      return titleText;
    }
    const bodyText = targetPost.body.trim();
    return bodyText ? truncatePostBody(bodyText) : '내용 없음';
  };

  const previousPostTitle = previousPost ? getAdjacentPostPreviewText(previousPost) : null;
  const nextPostTitle = nextPost ? getAdjacentPostPreviewText(nextPost) : null;

  return (
    <section className="grid grid-cols-1 gap-2 border-t border-[#e8e8e8] pt-4 sm:grid-cols-2">
      {previousPost ? (
        <Link
          href={createPostHref(previousPost.id)}
          className={outlineActionButtonClass}
          aria-label={`이전 글로 이동: ${previousPostTitle}`}
        >
          <span className="mr-1 shrink-0">이전 글:</span>
          <span className="line-clamp-1 min-w-0">
            {previousPostTitle}
          </span>
        </Link>
      ) : (
        <button type="button" disabled className={`${outlineActionButtonClass} text-[#888]`}>
          이전 글이 없어요
        </button>
      )}
      {nextPost ? (
        <Link
          href={createPostHref(nextPost.id)}
          className={outlineActionButtonClass}
          aria-label={`다음 글로 이동: ${nextPostTitle}`}
        >
          <span className="mr-1 shrink-0">다음 글:</span>
          <span className="line-clamp-1 min-w-0">
            {nextPostTitle}
          </span>
        </Link>
      ) : (
        <button type="button" disabled className={`${outlineActionButtonClass} text-[#888]`}>
          다음 글이 없어요
        </button>
      )}
    </section>
  );
}

type CommentsSectionProps = {
  postId: string;
  postCountryId: string | null;
  postCityId: string | null;
  postAuthorId: string;
  bestCommentId: string | null;
  commentCount: number;
  currentUser: Awaited<ReturnType<typeof getCurrentUser>>;
  reportOptions: { id: string; label: string }[];
  canModerateComments: boolean;
  query: Awaited<PostDetailPageProps['searchParams']>;
};

async function CommentsSection({
  postId,
  postCountryId,
  postCityId,
  postAuthorId,
  bestCommentId,
  commentCount,
  currentUser,
  reportOptions,
  canModerateComments,
  query,
}: CommentsSectionProps) {
  const commentsCursor = toSingle(query.commentsCursor);
  const commentsDirection = toSingle(query.commentsDirection) === 'prev' ? 'prev' : 'next';
  const { visibleComments, hasPrevPage, hasNextPage } = await getPostComments(
    postId,
    commentsCursor,
    commentsDirection,
    currentUser?.id ?? null,
    canModerateComments,
  );
  const firstComment = visibleComments[0];
  const lastComment = visibleComments[visibleComments.length - 1];

  const visibleCommentIds = visibleComments.map((c) => c.id);
  const myCommentReports =
    currentUser && reportOptions.length > 0 && visibleCommentIds.length > 0
      ? await prisma.commentReport.findMany({
          where: { commentId: { in: visibleCommentIds }, reporterId: currentUser.id },
          select: { commentId: true, optionId: true, additionalReason: true },
        })
      : [];
  const myCommentReportMap = new Map(
    myCommentReports.map((r) => [r.commentId, r]),
  );
  const authorAccountOptions =
    currentUser && canSelectAuthorAccount(currentUser)
      ? await getAuthorAccountOptionsForActor(currentUser, [
          {
            countryId: postCountryId,
            cityId: postCityId,
          },
        ])
      : [];

  const createCommentPageHref = (nextCursor: string, nextDirection: 'next' | 'prev') => {
    const queryString = new URLSearchParams();
    for (const categoryId of toArray(query.category)) {
      if (categoryId.trim()) {
        queryString.append('category', categoryId.trim());
      }
    }
    for (const cityId of toArray(query.city)) {
      if (cityId.trim()) {
        queryString.append('city', cityId.trim());
      }
    }
    for (const categoryType of toArray(query.type)) {
      if (categoryType.trim()) {
        queryString.append('type', categoryType.trim());
      }
    }
    for (const tagId of toArray(query.tag)) {
      if (tagId.trim()) {
        queryString.append('tag', tagId.trim());
      }
    }
    const keyword = toSingle(query.q);
    if (keyword) {
      queryString.set('q', keyword);
    }
    const listCursor = toSingle(query.cursor);
    if (listCursor) {
      queryString.set('cursor', listCursor);
    }
    const listDirection = toSingle(query.direction);
    if (listDirection === 'prev') {
      queryString.set('direction', 'prev');
    }
    queryString.set('commentsCursor', nextCursor);
    if (nextDirection === 'prev') {
      queryString.set('commentsDirection', 'prev');
    }

    return `/posts/${postId}?${queryString.toString()}`;
  };

  return (
    <section className="space-y-3 border-t border-[#e8e8e8] pt-4">
      <h2 id="comments" className="text-base font-bold">댓글 {commentCount}개</h2>

      {currentUser ? (
        <PostCommentComposer
          postId={postId}
          currentUserLoggedIn
          canSelectAuthorAccount={Boolean(currentUser && canSelectAuthorAccount(currentUser))}
          canGenerateDraft={Boolean(currentUser && canUseAutoContentGeneration(currentUser))}
          authorAccountOptions={authorAccountOptions}
        />
      ) : (
        <PostCommentComposer
          postId={postId}
          currentUserLoggedIn={false}
          canSelectAuthorAccount={false}
          canGenerateDraft={false}
          authorAccountOptions={[]}
        />
      )}

      {visibleComments.length === 0 ? (
        <p className="text-sm text-[#888]">아직 댓글이 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {visibleComments.map((comment) => {
            const canDelete = canDeleteComment(currentUser, comment);
            const isBestComment = comment.id === bestCommentId;
            const canManageBestComment = currentUser?.id === postAuthorId;
            const isCommentLikedByCurrentUser = comment.commentLikes.length > 0;
            const canReport = canReportComment(currentUser, comment);
            const myCommentReport = myCommentReportMap.get(comment.id) ?? null;
            const canShowCommentOverflowMenu =
              (canReport && reportOptions.length > 0) || canDelete || canModerateComments;

            return (
              <li key={comment.id} className="relative rounded-2xl border border-[#e8e8e8] bg-white p-4 sm:pr-12 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                {canShowCommentOverflowMenu ? (
                  <div className="absolute right-3 top-3 z-10">
                    <OverflowMenu panelClassName="w-64">
                      {canReport && reportOptions.length > 0 ? (
                        <details className="group/report rounded-lg">
                          <summary className={`${overflowMenuItemClassName} flex cursor-pointer list-none items-center justify-between`}>
                            <span>신고하기</span>
                            <span className="text-xs text-[#999] transition group-open/report:rotate-180">▼</span>
                          </summary>
                          <div className="mt-2 space-y-2 border-t border-[#f0f0f0] px-1 pt-2">
                            {myCommentReport ? (
                              <p className="text-xs text-[#888]">
                                이미 신고한 댓글입니다. 다시 제출하면 신고 내용이 업데이트됩니다.
                              </p>
                            ) : null}
                            <form action={reportCommentAction} className="space-y-2">
                              <input type="hidden" name="postId" value={postId} />
                              <input type="hidden" name="commentId" value={comment.id} />
                              <label htmlFor={`comment-report-option-${comment.id}`} className="text-xs text-[#555]">
                                신고 사유
                              </label>
                              <select
                                id={`comment-report-option-${comment.id}`}
                                name="optionId"
                                defaultValue={myCommentReport?.optionId ?? ''}
                                required
                                className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
                              >
                                <option value="" disabled>
                                  신고 사유를 선택해 주세요
                                </option>
                                {reportOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <label htmlFor={`comment-report-additional-${comment.id}`} className="text-xs text-[#555]">
                                추가 사유 (선택)
                              </label>
                              <textarea
                                id={`comment-report-additional-${comment.id}`}
                                name="additionalReason"
                                rows={3}
                                maxLength={500}
                                defaultValue={myCommentReport?.additionalReason ?? ''}
                                placeholder="옵션 외 추가로 설명할 내용이 있다면 입력해 주세요."
                                className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
                              />
                              <FormSubmitButton
                                idleLabel={myCommentReport ? '신고 내용 수정' : '신고 접수'}
                                pendingLabel="접수 중..."
                                className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm font-medium text-[#444] hover:bg-[#f7f7f7]"
                              />
                            </form>
                          </div>
                        </details>
                      ) : null}
                      {canModerateComments && comment.status === 'PUBLISHED' ? (
                        <details className="group/hold rounded-lg">
                          <summary className={`${overflowMenuItemClassName} flex cursor-pointer list-none items-center justify-between`}>
                            <span>보류 처리</span>
                            <span className="text-xs text-[#999] transition group-open/hold:rotate-180">▼</span>
                          </summary>
                          <form action={holdCommentAction} className="mt-2 space-y-2 border-t border-[#f0f0f0] px-1 pt-2">
                            <input type="hidden" name="postId" value={postId} />
                            <input type="hidden" name="commentId" value={comment.id} />
                            <input
                              type="text"
                              name="reason"
                              placeholder="보류 사유 (선택)"
                              className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
                            />
                            <FormSubmitButton
                              idleLabel="보류 확정"
                              pendingLabel="처리 중..."
                              className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm font-medium text-[#444] hover:bg-[#f7f7f7]"
                            />
                          </form>
                        </details>
                      ) : null}
                      {canModerateComments && comment.status === 'HELD' ? (
                        <form action={restoreCommentAction} className="w-full">
                          <input type="hidden" name="postId" value={postId} />
                          <input type="hidden" name="commentId" value={comment.id} />
                          <FormSubmitButton
                            idleLabel="재게시"
                            pendingLabel="처리 중..."
                            className={overflowMenuItemClassName}
                          />
                        </form>
                      ) : null}
                      {canDelete ? (
                        <form action={deleteCommentAction} className="w-full">
                          <input type="hidden" name="postId" value={postId} />
                          <input type="hidden" name="commentId" value={comment.id} />
                          <FormSubmitButton
                            idleLabel="삭제하기"
                            pendingLabel="삭제 중..."
                            className={`${overflowMenuItemClassName} text-red-600`}
                          />
                        </form>
                      ) : null}
                    </OverflowMenu>
                  </div>
                ) : null}
                {comment.status === 'HELD' && !canModerateComments ? (
                  <p className="text-sm italic text-[#aaa]">운영 검토 중인 댓글입니다.</p>
                ) : (
                  <>
                    {comment.status === 'HELD' && canModerateComments ? (
                      <span className="mb-1 inline-block rounded-full bg-[#fffde7] px-2 py-0.5 text-xs font-medium text-[#7a6000]">
                        운영 검토 중
                      </span>
                    ) : null}
                    <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#222]">{comment.body}</p>
                  </>
                )}
                {isBestComment ? (
                  <p className="mt-3 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    베스트 댓글
                  </p>
                ) : null}
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {shouldShowOperatorBadge(comment.author) ? (
                        <>
                          <UserAvatar
                            displayName={comment.author.displayName}
                            profileImageUrl={comment.author.profileImageUrl}
                            className="h-7 w-7"
                            sizes="28px"
                          />
                          <div className="min-w-0 text-xs text-[#777]">
                            <p className="truncate text-sm font-medium text-[#444]">
                              {comment.author.displayName}
                              <span className="ml-1 rounded bg-[#3c1e1e] px-1 py-0.5 text-[10px] font-bold text-white">
                                운영자
                              </span>
                            </p>
                            <p className="truncate">
                              <DateTimeText value={comment.createdAt} />
                            </p>
                          </div>
                        </>
                      ) : (
                        <Link href={`/users/${comment.authorId}`} className="flex min-w-0 items-center gap-2 hover:opacity-80">
                          <UserAvatar
                            displayName={comment.author.displayName}
                            profileImageUrl={comment.author.profileImageUrl}
                            className="h-7 w-7"
                            sizes="28px"
                          />
                          <div className="min-w-0 text-xs text-[#777]">
                            <p className="truncate text-sm font-medium text-[#444]">
                              {comment.author.displayName}
                            </p>
                            <p className="truncate">
                              {shouldShowWarmth(comment.author) ? (
                                <>
                                  <NeighbourWarmthLabel warmth={comment.author.neighbourWarmth} /> ·{' '}
                                </>
                              ) : null}
                              <DateTimeText value={comment.createdAt} />
                            </p>
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                  <CommentActionButtons>
                    {currentUser ? (
                      <form action={toggleCommentLikeAction}>
                        <input type="hidden" name="postId" value={postId} />
                        <input type="hidden" name="commentId" value={comment.id} />
                        <IconActionButton
                          type="submit"
                          size="compact"
                          icon={<HeartIcon filled={isCommentLikedByCurrentUser} />}
                          count={comment._count.commentLikes}
                          tone="like"
                          active={isCommentLikedByCurrentUser}
                          aria-label={isCommentLikedByCurrentUser ? '좋아요 취소' : '좋아요'}
                          title={isCommentLikedByCurrentUser ? '좋아요 취소' : '좋아요'}
                        />
                      </form>
                    ) : (
                      <IconActionLink
                        href="/login"
                        icon={<HeartIcon />}
                        count={comment._count.commentLikes}
                        size="compact"
                        aria-label="좋아요"
                        title="좋아요"
                      />
                    )}
                    {canManageBestComment ? (
                      isBestComment ? (
                        <form action={removeBestCommentAction}>
                          <input type="hidden" name="postId" value={postId} />
                          <FormSubmitButton
                            idleLabel="베스트 댓글 해제"
                            pendingLabel="처리 중..."
                            className="rounded-md border border-amber-200 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50"
                          />
                        </form>
                      ) : (
                        <form action={setBestCommentAction}>
                          <input type="hidden" name="postId" value={postId} />
                          <input type="hidden" name="commentId" value={comment.id} />
                          <FormSubmitButton
                            idleLabel="베스트 댓글"
                            pendingLabel="처리 중..."
                            className="rounded-md border border-amber-200 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50"
                          />
                        </form>
                      )
                    ) : null}
                  </CommentActionButtons>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasPrevPage || hasNextPage ? (
        <nav className="flex items-center justify-between gap-2 pt-1" aria-label="댓글 페이지 이동">
          {hasPrevPage && firstComment ? (
            <Link
              href={createCommentPageHref(encodeCursor(firstComment), 'prev')}
              className="rounded-xl border border-[#e8e8e8] px-4 py-2 text-sm hover:bg-[#f9f9f9]"
            >
              이전 댓글
            </Link>
          ) : (
            <span />
          )}
          {hasNextPage && lastComment ? (
            <Link
              href={createCommentPageHref(encodeCursor(lastComment), 'next')}
              className="rounded-xl border border-[#e8e8e8] px-4 py-2 text-sm hover:bg-[#f9f9f9]"
            >
              다음 댓글
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
