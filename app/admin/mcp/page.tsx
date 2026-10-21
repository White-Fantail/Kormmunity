import { redirect } from 'next/navigation';

import { revokeMcpClientAction } from '@/app/admin/mcp/actions';
import { adminManagementNavItems, ManagementSectionHeader } from '@/components/admin/management-section-nav';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { mcpResource } from '@/lib/mcp/oauth';
import { isAdmin } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function AdminMcpPage() {
  const actor = await getCurrentUser();
  if (!actor || !isAdmin(actor) || !actor.isActive || actor.status !== 'ACTIVE') {
    redirect('/posts');
  }
  const grants = await prisma.mcpOAuthToken.findMany({
    where: { userId: actor.id, revokedAt: null,
      OR: [{ expiresAt: { gt: new Date() } }, { refreshExpiresAt: { gt: new Date() } }] },
    select: { clientId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const clients = await prisma.mcpOAuthClient.findMany({
    where: { id: { in: grants.map((grant) => grant.clientId) } },
    select: { id: true, name: true, createdAt: true },
  });
  return (
    <section className="space-y-6">
      <ManagementSectionHeader sectionLabel="관리자" pageLabel="ChatGPT / MCP 연결"
        items={adminManagementNavItems} />
      <div className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold">MCP 연결 주소</h2>
        <p className="text-sm text-gray-600">
          ChatGPT의 사용자 정의 MCP 앱을 만들고 아래 URL을 입력하세요.
          카카오 관리자 계정으로 로그인한 후 접속 권한을 승인해야 합니다.
        </p>
        <code className="block break-all rounded-lg bg-gray-100 p-3 text-sm">{mcpResource()}</code>
        <p className="text-sm text-gray-600">
          연결 후 운영 계정 목록을 조회하고 계정을 선택하면 그 계정의 성격,
          기존 글과 지역별 공개 게시글을 참고해 새로운 글을 작성할 수 있습니다.
          먼저 초안을 만들고 확인 후에 게시하세요.
        </p>
      </div>
      <div className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold">내 활성 연결</h2>
        {clients.length === 0 ? <p className="text-sm text-gray-500">활성 연결이 없습니다.</p> :
          <ul className="space-y-3">
            {clients.map((client) => (
              <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div>
                  <p className="font-semibold">{client.name}</p>
                  <p className="text-xs text-gray-500">연결 ID: {client.id.slice(0, 10)}…</p>
                </div>
                <form action={revokeMcpClientAction}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <button type="submit" className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">
                    연결 해제
                  </button>
                </form>
              </li>
            ))}
          </ul>}
        <p className="text-xs text-gray-500">연결을 해제하면 기존 access/refresh token이 즉시 무효화됩니다.</p>
      </div>
    </section>
  );
}
