import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  adminChangePostCategoryAction,
  adminDeletePostAction,
  adminRestorePostAction,
  pinPostAction,
  unpinPostAction,
} from '@/app/admin/actions';
import { adminManagementNavItems, ManagementSectionNav } from '@/components/admin/management-section-nav';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canMakeFinalUserDecision } from '@/lib/permissions';
import { DateTimeText } from '@/components/ui/date-time-text';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { truncatePostBody } from '@/lib/posts/constants';
import { getCategoryDisplayName } from '@/lib/posts/category-display';
import { PINNED_POST_ORDER_DESC } from '@/lib/posts/pinned-order';



export const dynamic = 'force-dynamic';

type AdminPostsPageProps = {
  searchParams: Promise<{ status?: string; error?: string; success?: string }>;
};

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !canMakeFinalUserDecision(currentUser)) {
    redirect('/posts');
  }

  const params = await searchParams;
  const statusFilter = params.status ?? 'HELD';

  const [posts, moderationActions, categories] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: statusFilter as 'PUBLISHED' | 'HELD' | 'DELETED',
      },
      orderBy: PINNED_POST_ORDER_DESC,
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        isPinned: true,
        communityScore: true,
        heldReason: true,
        deletedReason: true,
        heldAt: true,
        deletedAt: true,
        createdAt: true,
        author: { select: { id: true, displayName: true } },
        category: { select: { id: true, name: true, type: true } },
        tags: {
          select: {
            postTagOption: { select: { id: true, label: true, isActive: true } },
          },
        },
        city: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.moderationAction.findMany({
      where: { targetType: 'POST' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        targetId: true,
        actionType: true,
        reason: true,
        createdAt: true,
        actor: { select: { displayName: true } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  const statusOptions = [
    { value: 'PUBLISHED', label: '게시됨' },
    { value: 'HELD', label: '보류' },
    { value: 'DELETED', label: '삭제됨' },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">관리자 — 게시글 관리</h1>
        <ManagementSectionNav items={adminManagementNavItems} />
      </div>

      {params.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      ) : null}
      {params.success ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{params.success}</p>
      ) : null}

      <div className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">게시글 목록</h2>

        <form className="mb-4 flex flex-wrap gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="submit"
              name="status"
              value={opt.value}
              className={`rounded-full px-3 py-1 text-sm border transition ${
                statusFilter === opt.value
                  ? 'bg-[#fee500] text-[#3c1e1e] border-[#fee500] font-semibold'
                  : 'border-[#e8e8e8] hover:border-[#fee500] hover:bg-[#fffde7]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </form>

        {posts.length === 0 ? (
          <p className="text-sm text-[#888]">해당 상태의 게시글이 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id} className="space-y-2 rounded-xl border border-[#e8e8e8] p-3">
                <div className="flex flex-wrap gap-2 text-xs text-[#888]">
                  <span className="rounded-full bg-[#fffde7] px-2 py-0.5 font-medium text-[#7a6000]">{getCategoryDisplayName(post.category)}</span>
                  <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[#3730a3]">{post.category.type}</span>
                  <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5">{post.city?.name ?? '전 지역'}</span>
                  {post.tags.map((tag) => (
                    <span
                      key={tag.postTagOption.id}
                      className={`rounded-full px-2 py-0.5 ${
                        tag.postTagOption.isActive
                          ? 'bg-[#e8f0fe] text-[#1a56db]'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tag.postTagOption.label}
                      {tag.postTagOption.isActive ? '' : ' (비활성 태그)'}
                    </span>
                  ))}
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      post.status === 'HELD'
                        ? 'bg-[#fffde7] text-[#7a6000]'
                        : post.status === 'DELETED'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-green-50 text-green-800'
                    }`}
                  >
                    {post.status === 'HELD' ? '보류' : post.status === 'DELETED' ? '삭제됨' : '게시됨'}
                  </span>
                  {post.isPinned ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">📌 고정</span>
                  ) : null}
                </div>

                <Link href={`/posts/${post.id}`} className="block text-sm font-medium hover:underline">
                  {post.title ?? truncatePostBody(post.body)}
                </Link>
                <p className="text-xs text-[#888]">
                  <span>작성자: {post.author.displayName}</span>
                  {' · '}
                  <span><DateTimeText value={post.createdAt} /></span>
                  {' · '}
                  <span aria-label={`신고 ${post._count.reports}건`}>신고 {post._count.reports}건</span>
                  {' · '}
                  <span aria-label={`커뮤니티 점수 ${post.communityScore.toFixed(1)}`}>점수 {post.communityScore.toFixed(1)}</span>
                </p>
                {post.heldReason ? (
                  <p className="text-xs text-[#7a6000]">보류 사유: {post.heldReason}</p>
                ) : null}
                {post.deletedReason ? (
                  <p className="text-xs text-red-600">삭제 사유: {post.deletedReason}</p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {post.status === 'PUBLISHED' ? (
                    <form action={post.isPinned ? unpinPostAction : pinPostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <FormSubmitButton
                        idleLabel={post.isPinned ? '고정 해제' : '상단 고정'}
                        pendingLabel="처리 중..."
                        className={`rounded-xl px-2 py-1 text-xs font-medium ${
                          post.isPinned
                            ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                            : 'border border-[#e8e8e8] hover:bg-[#f9f9f9]'
                        }`}
                      />
                    </form>
                  ) : null}

                  {post.status !== 'DELETED' ? (
                    <details>
                      <summary className="cursor-pointer rounded-xl border border-[#e8e8e8] px-2 py-1 text-xs font-medium hover:bg-[#f9f9f9]">
                        카테고리 변경
                      </summary>
                      <form action={adminChangePostCategoryAction} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="postId" value={post.id} />
                        <select
                          name="categoryId"
                          defaultValue={post.category.id}
                          className="min-w-44 rounded-lg border border-[#e8e8e8] px-2 py-1 text-sm focus:border-[#fee500] focus:outline-none"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {getCategoryDisplayName(category)}
                            </option>
                          ))}
                        </select>
                        <FormSubmitButton
                          idleLabel="변경"
                          pendingLabel="변경 중..."
                          className="rounded-xl border border-[#e8e8e8] px-3 py-1 text-xs font-medium hover:bg-[#f9f9f9]"
                        />
                      </form>
                    </details>
                  ) : null}

                  {post.status !== 'DELETED' ? (
                    <details>
                      <summary className="cursor-pointer rounded-xl border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                        삭제
                      </summary>
                      <form action={adminDeletePostAction} className="mt-2 space-y-2">
                        <input type="hidden" name="postId" value={post.id} />
                        <input
                          type="text"
                          name="reason"
                          placeholder="삭제 사유 (선택)"
                          className="w-full rounded-lg border border-[#e8e8e8] px-2 py-1 text-sm focus:border-[#fee500] focus:outline-none"
                        />
                        <FormSubmitButton
                          idleLabel="삭제 확정"
                          pendingLabel="삭제 중..."
                          className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700"
                        />
                      </form>
                    </details>
                  ) : null}

                  {post.status === 'HELD' ? (
                    <form action={adminRestorePostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <FormSubmitButton
                        idleLabel="재게시"
                        pendingLabel="처리 중..."
                        className="rounded-xl border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                      />
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">최근 게시글 모더레이션 로그</h2>
        {moderationActions.length === 0 ? (
          <p className="text-sm text-[#888]">로그가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {moderationActions.map((action) => (
              <li key={action.id} className="rounded-lg border border-[#e8e8e8] p-2 text-xs">
                <details>
                  <summary className="cursor-pointer list-none">
                    <span className="font-medium">{action.actor.displayName}</span>
                    {' → '}
                    <span className="text-[#555]">{action.actionType}</span>
                    {' · '}
                    <span className="font-mono text-[#aaa]">{action.targetId.slice(0, 8)}…</span>
                    <span className="ml-2 text-[#aaa]">
                      <DateTimeText value={action.createdAt} />
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1 rounded-md bg-[#fafafa] p-2 text-[#666]">
                    <p>
                      <span className="font-medium">액션 코드:</span> {action.actionType}
                    </p>
                    <p>
                      <span className="font-medium">대상 게시글 ID:</span>{' '}
                      <span className="font-mono">{action.targetId}</span>
                    </p>
                    <p>
                      <span className="font-medium">사유:</span> {action.reason ?? '없음'}
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
