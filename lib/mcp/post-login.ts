export const MCP_LOGIN_NEXT_COOKIE = 'kormmunity_mcp_login_next';

/** Only finish an already initiated local MCP consent flow, never arbitrary URLs. */
export function safeMcpLoginNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 3000 ||
      !value.startsWith('/mcp/consent?') || value.includes('\\') ||
      value.includes('\r') || value.includes('\n')) return null;
  return value;
}
