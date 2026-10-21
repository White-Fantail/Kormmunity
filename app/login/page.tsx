import Link from 'next/link';

import { loginWithKakaoPlaceholder } from '@/app/login/actions';
import { safeMcpLoginNext } from '@/lib/mcp/post-login';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  oauth: '카카오 로그인 중 오류가 발생했어요. 다시 시도해 주세요.',
  config: '카카오 로그인 설정이 올바르지 않아요. 관리자에게 문의하세요.',
  missing: '로그인 정보가 부족해요.',
  forbidden: '해당 계정은 직접 로그인할 수 없는 운영 계정입니다.',
};

const kakaoConfigured =
  Boolean(process.env.KAKAO_CLIENT_ID) && Boolean(process.env.KAKAO_REDIRECT_URI);

const demoUsers = [
  { kakaoId: 'demo-user-001', displayName: '데모 사용자', role: 'USER' },
  {
    kakaoId: 'demo-moderator-001',
    displayName: '데모 모더레이터',
    role: 'MODERATOR',
  },
  {
    kakaoId: 'demo-coordinator-001',
    displayName: '데모 운영진',
    role: 'COORDINATOR',
  },
  { kakaoId: 'demo-admin-001', displayName: '데모 관리자', role: 'ADMIN' },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeMcpLoginNext(params.next);
  const errorMessage = params.error ? (ERROR_MESSAGES[params.error] ?? '알 수 없는 오류가 발생했어요.') : null;

  return (
    <section className="space-y-5">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fee500] text-xl font-black text-[#3c1e1e]">K</span>
        <h1 className="text-xl font-bold">로그인</h1>
      </div>

      {errorMessage ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {kakaoConfigured ? (
        <div className="space-y-3">
          <a
            href={next ? '/api/auth/kakao?next=' + encodeURIComponent(next) : '/api/auth/kakao'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] px-4 py-3.5 text-base font-bold text-[#3c1e1e] shadow-sm hover:bg-[#f5db00] active:scale-[0.98]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path
                fill="currentColor"
                d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.62 5.085 4.073 6.525L5.1 21l4.89-2.925c.65.09 1.32.135 2.01.135 5.523 0 10-3.477 10-7.8S17.523 3 12 3z"
              />
            </svg>
            카카오 계정으로 로그인
          </a>
          <p className="text-center text-xs text-[#aaa]">
            로그인 또는 가입 시{' '}
            <Link href="/legal/terms" className="underline hover:text-[#555]">이용약관</Link>
            ,{' '}
            <Link href="/legal/privacy" className="underline hover:text-[#555]">개인정보처리방침</Link>
            ,{' '}
            <Link href="/legal/community-guidelines" className="underline hover:text-[#555]">운영정책</Link>
            에 동의한 것으로 간주됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#888]">
            카카오 로그인 연동 전까지 사용할 개발용 임시 로그인입니다.
          </p>
          <div className="space-y-2">
            {demoUsers.map((user) => (
              <form key={user.kakaoId} action={loginWithKakaoPlaceholder}>
                <input type="hidden" name="kakaoId" value={user.kakaoId} />
                <input type="hidden" name="displayName" value={user.displayName} />
                <input type="hidden" name="role" value={user.role} />
                {next ? <input type="hidden" name="next" value={next} /> : null}
                <button
                  type="submit"
                  className="w-full rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 text-left text-sm font-medium hover:border-[#fee500] hover:bg-[#fffde7]"
                >
                  {user.displayName}로 시작하기
                </button>
              </form>
            ))}
          </div>
          <p className="text-center text-xs text-[#aaa]">
            로그인 또는 가입 시{' '}
            <Link href="/legal/terms" className="underline hover:text-[#555]">이용약관</Link>
            ,{' '}
            <Link href="/legal/privacy" className="underline hover:text-[#555]">개인정보처리방침</Link>
            ,{' '}
            <Link href="/legal/community-guidelines" className="underline hover:text-[#555]">운영정책</Link>
            에 동의한 것으로 간주됩니다.
          </p>
        </div>
      )}

      <Link href="/posts" className="block text-center text-sm text-[#888] underline">
        홈으로 이동
      </Link>
    </section>
  );
}
