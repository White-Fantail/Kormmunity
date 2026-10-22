import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { parseAuthorizeParams, requireCurrentAdmin } from '@/lib/mcp/oauth';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function McpConsentPage({ searchParams }: Props) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const params = await parseAuthorizeParams(query);
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/mcp/consent?' + query.toString()));
  const admin = await requireCurrentAdmin(user.id);
  return (
    <section className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-white p-6">
      <h1 className="text-xl font-bold">Kormmunity MCP 연결 승인</h1>
      <p className="text-sm text-gray-700">
        <strong>{admin.displayName}</strong> 관리자 계정으로 외부 앱
        <strong> {params.clientName}</strong>의 연결 요청을 승인하시겠습니까?
      </p>
      <p className="text-sm text-gray-700">
        이 연결은 운영 계정 목록, 페르소나, 공개 게시글을 읽고 운영 계정 명의의
        글을 초안으로 저장하거나, 명시적 요청 시 게시할 수 있습니다.
        실제 사용자 계정으로 글을 대리 작성할 수 없습니다.
        승인하면 1시간짜리 접근 토큰과 자동 갱신용 토큰(30일 미사용 시 만료)이
        발급되며, 관리자 MCP 화면에서 언제든 연결을 해제할 수 있습니다.
      </p>
      <p className="text-xs text-gray-500">
        대상: {params.resource}
        {' / '}권한: {params.scope}
        {' / '}연결 앱: {params.clientName}
      </p>
      <form action={'/api/oauth/authorize?' + query.toString()} method="post" className="flex gap-3">
        <button type="submit" name="decision" value="approve"
          className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">연결 승인</button>
        <button type="submit" name="decision" value="deny"
          className="rounded-xl border px-5 py-3 font-semibold">취소</button>
      </form>
    </section>
  );
}
