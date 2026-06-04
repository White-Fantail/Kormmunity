import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReportReviewStatus } from '@prisma/client';

import {
  changePostCategoryAction,
  holdPostAction,
  restorePostAction,
  requestUserReviewAction,
} from '@/app/moderator/actions';
import {
  moderatorManagementNavItems,
  ManagementSectionHeader,
} from '@/components/admin/management-section-nav';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canModerate } from '@/lib/permissions';
import { DateTimeText } from '@/components/ui/date-time-text';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { truncatePostBody } from '@/lib/posts/constants';
import { getCategoryDisplayName } from '@/lib/posts/category-display';


export const dynamic = 'force-dynamic';

type CoordinatorPageProps = {
  searchParams: Promise<{ status?: string; error?: string; success?: string; uq?: string }>;
};

export default async function CoordinatorPage({ searchParams }: CoordinatorPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !canModerate(currentUser)) {
    redirect('/posts');
  }

  const params = await searchParams;
  const statusFilter = params.status ?? 'HELD';
  const userNameQuery = params.uq?.trim() ?? '';
  const recentUsersPromise = prisma.user
    .findMany({
      where: {
        isManagedAccount: false,
        ...(userNameQuery ? { displayName: { contains: userNameQuery, mode: 'insensitive' } } : {}),
        NOT: {
          staffAssignments: {
            some: { isActive: true, role: 'ADMIN' },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        displayName: true,
        status: true,
        createdAt: true,
        staffAssignments: {
          where: { isActive: true },
          select: { role: true },
        },
      },
    });

  const [posts, recentUsers, unresolvedPostReportCount, unresolvedCommentReportCount, categories] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: statusFilter as 'PUBLISHED' | 'HELD' | 'DELETED',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        communityScore: true,
        heldReason: true,
        heldAt: true,
        createdAt: true,
        author: { select: { id: true, displayName: true } },
        category: { select: { id: true, name: true, type: true } },
        city: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    }),
    recentUsersPromise,
    prisma.postReport.count({
      where: { reviewStatus: ReportReviewStatus.PENDING },
    }),
    prisma.commentReport.count({
      where: { reviewStatus: ReportReviewStatus.PENDING },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, type: true },
    }),
  ]);
  const unresolvedReportCount = unresolvedPostReportCount + unresolvedCommentReportCount;

  const statusOptions = [
    { value: 'PUBLISHED', label: '게시됨' },
    { value: 'HELD', label: '보류' },
    { value: 'DELETED', label: '삭제됨' },
  ];

  return (
    <section className="space-y-6">
      <ManagementSectionHeader
        sectionLabel="운영 관리"
        pageLabel="대시보드"
        items={moderatorManagementNavItems}
      />

      {params.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      ) : null}
      {params.success ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{params.success}</p>
      ) : null}

      {unresolvedReportCount > 0 ? (
        <Link
          href="/moderator/reports"
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100"
        >
          <span>미확정 신고 내역이 있습니다.</span>
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
            {unresolvedReportCount}건
          </span>
        </Link>
      ) : null}

      <div className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">게시글 관리</h2>

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
              <li key={post.id} className="rounded-xl border border-[#e8e8e8] p-3">
                <div className="mb-1 flex flex-wrap gap-2 text-xs text-[#888]">
                  <span className="rounded-full bg-[#fffde7] px-2 py-0.5 font-medium text-[#7a6000]">{getCategoryDisplayName(post.category)}</span>
                  <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5">{post.city?.name ?? '전 지역'}</span>
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
                </div>

                <Link href={`/posts/${post.id}`} className="block text-sm font-medium hover:underline">
                  {post.title ?? truncatePostBody(post.body)}
                </Link>
                <p className="mt-1 text-xs text-[#888]">
                  <span>작성자: {post.author.displayName}</span>
                  {' · '}
                  <DateTimeText value={post.createdAt} />
                  {' · '}
                  <span aria-label={`신고 ${post._count.reports}건`}>신고 {post._count.reports}건</span>
                </p>
                {post.heldReason ? (
                  <p className="mt-1 text-xs text-[#7a6000]">보류 사유: {post.heldReason}</p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-2">
                  {post.status !== 'DELETED' ? (
                    <details className="w-full">
                      <summary className="inline-block cursor-pointer rounded-xl border border-[#e8e8e8] px-3 py-1 text-sm font-medium hover:bg-[#f9f9f9]">
                        카테고리 변경
                      </summary>
                      <form action={changePostCategoryAction} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="postId" value={post.id} />
                        <select
                          name="categoryId"
                          defaultValue={post.category.id}
                          className="min-w-44 rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
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
                          className="rounded-xl border border-[#e8e8e8] px-3 py-2 text-sm font-medium hover:bg-[#f9f9f9]"
                        />
                      </form>
                    </details>
                  ) : null}

                  {post.status === 'PUBLISHED' ? (
                    <details className="w-full">
                      <summary className="inline-block cursor-pointer rounded-xl border border-yellow-300 bg-[#fffde7] px-3 py-1 text-sm font-medium text-[#7a6000]">
                        보류 처리
                      </summary>
                      <form action={holdPostAction} className="mt-2 space-y-2">
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
                          className="rounded-xl bg-[#fee500] px-3 py-2 text-sm font-bold text-[#3c1e1e] hover:bg-[#f5db00]"
                        />
                      </form>
                    </details>
                  ) : null}

                  {post.status === 'HELD' ? (
                    <form action={restorePostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <FormSubmitButton
                        idleLabel="재게시"
                        pendingLabel="처리 중..."
                        className="rounded-xl border border-green-300 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-50"
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
        <h2 className="mb-3 font-semibold">사용자 검토 요청</h2>
        <p className="mb-3 text-sm text-[#888]">
          문제가 있는 사용자를 관리자 검토 대상으로 표시할 수 있습니다.
        </p>
        <form method="GET" className="mb-3 flex gap-2">
          {params.status ? (
            <input type="hidden" name="status" value={params.status} />
          ) : null}
          <input
            type="text"
            name="uq"
            defaultValue={userNameQuery}
            placeholder="닉네임 검색"
            className="flex-1 rounded-lg border border-[#e8e8e8] px-3 py-1.5 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#fee500] px-3 py-1.5 text-sm font-bold text-[#3c1e1e] hover:bg-[#f5db00]"
          >
            검색
          </button>
          {userNameQuery ? (
            <Link
              href={params.status ? `/moderator?status=${params.status}` : '/moderator'}
              className="rounded-xl border border-[#e8e8e8] px-3 py-1.5 text-sm hover:bg-[#f9f9f9]"
            >
              초기화
            </Link>
          ) : null}
        </form>

        {recentUsers.length === 0 ? (
          <p className="text-sm text-[#888]">사용자가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e8e8e8] p-3">
                <span className="flex-1 text-sm">
                  <Link href={`/users/${u.id}`} className="font-medium hover:underline">{u.displayName}</Link>
                  <span className="ml-2 text-xs text-[#aaa]">
                    {u.staffAssignments.some((a) => a.role === 'MODERATOR')
                      ? '모더레이터'
                      : u.staffAssignments.some((a) => a.role === 'COORDINATOR')
                        ? '운영'
                        : '일반'}{' '}
                    ·{' '}
                    {u.status === 'ACTIVE'
                      ? '활성'
                      : u.status === 'LIMITED'
                        ? '제한'
                        : u.status === 'SUSPENDED'
                          ? '정지'
                          : '삭제'}
                  </span>
                </span>
                <details>
                  <summary className="cursor-pointer rounded-xl border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                    검토 요청
                  </summary>
                  <form action={requestUserReviewAction} className="mt-2 space-y-2">
                    <input type="hidden" name="targetUserId" value={u.id} />
                    <input
                      type="text"
                      name="reason"
                      required
                      placeholder="검토 사유 (필수)"
                      className="w-full rounded-lg border border-[#e8e8e8] px-3 py-1 text-sm focus:border-[#fee500] focus:outline-none focus:ring-2 focus:ring-[#fee500]/40"
                    />
                    <FormSubmitButton
                      idleLabel="검토 요청 제출"
                      pendingLabel="처리 중..."
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700"
                    />
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
