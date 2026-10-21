import { HeaderNavLink } from '@/components/ui/header-nav-link';

type ManagementNavItem = {
  href: `/${string}`;
  label: string;
};

export const coordinatorSectionNavItems = [
  { href: '/coordination', label: '대시보드' },
  { href: '/coordination/posts', label: '게시글 목록' },
] as const satisfies readonly ManagementNavItem[];

export const moderatorManagementNavItems = [
  { href: '/moderator', label: '대시보드' },
  { href: '/moderator/reports', label: '신고 내역' },
  { href: '/moderator/kakao-messages', label: '카카오 알림 로그' },
  { href: '/moderator/warmth-logs', label: '온기 변동 로그' },
  { href: '/moderator/score-logs', label: '커뮤니티점수 로그' },
  { href: '/moderator/location-logs', label: '위치 변경 로그' },
] as const satisfies readonly ManagementNavItem[];

/** @deprecated Use moderatorManagementNavItems */
export const coordinatorManagementNavItems = moderatorManagementNavItems;

export const adminManagementNavItems = [
  { href: '/admin/dashboard', label: '대시보드' },
  { href: '/admin/search-alerts', label: '검색어 통계' },
  { href: '/admin/users', label: '사용자 관리' },
  { href: '/admin/managed-accounts', label: '운영 계정 관리' },
  { href: '/admin/mcp', label: 'ChatGPT MCP' },
  { href: '/admin/posts', label: '게시글' },
  { href: '/admin/post-permissions', label: '게시글 권한' },
  { href: '/admin/report-options', label: '신고 옵션' },
  { href: '/admin/reputation-settings', label: '점수/온기 설정' },
  { href: '/admin/categories', label: '카테고리' },
  { href: '/admin/cities', label: '국가/도시' },
  { href: '/admin/partner-incentives', label: '파트너 인센티브' },
] as const satisfies readonly ManagementNavItem[];

export const adsManagerNavItems = [
  { href: '/ads-manager/dashboard', label: '대시보드' },
  { href: '/ads-manager/campaigns', label: '캠페인' },
  { href: '/ads-manager/proposals', label: '광고 제안' },
  { href: '/ads-manager/contents', label: '광고 콘텐츠' },
  { href: '/ads-manager/products', label: '광고 상품' },
  { href: '/ads-manager/rules', label: '노출 규칙' },
] as const satisfies readonly ManagementNavItem[];

export const partnerManagerNavItems = [
  { href: '/partner-manager', label: '광고주 관리' },
  { href: '/partner-manager/sales', label: '영업 실적' },
] as const satisfies readonly ManagementNavItem[];

export const advertiserMemberNavItems = [
  { href: '/advertiser-member/campaigns', label: '캠페인 조회' },
  { href: '/advertiser-member/proposals', label: '광고 제안' },
] as const satisfies readonly ManagementNavItem[];

type ManagementSectionNavProps = {
  items: readonly ManagementNavItem[];
};

export function ManagementSectionNav({ items }: ManagementSectionNavProps) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {items.map((item) => (
        <HeaderNavLink key={item.href} href={item.href}>
          {item.label}
        </HeaderNavLink>
      ))}
    </nav>
  );
}

type ManagementSectionHeaderProps = {
  sectionLabel: string;
  pageLabel: string;
  items: readonly ManagementNavItem[];
};

export function ManagementSectionHeader({
  sectionLabel,
  pageLabel,
  items,
}: ManagementSectionHeaderProps) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">
        {sectionLabel} — {pageLabel}
      </h1>
      <ManagementSectionNav items={items} />
    </div>
  );
}
