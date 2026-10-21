export const MCP_LOGIN_NEXT_COOKIE = 'kormmunity_mcp_login_next';

/** Only finish an already initiated local MCP consent flow, never arbitrary URLs. */
export function safeMcpLoginNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 3000 ||
      !value.startsWith('/mcp/consent?') ||
      value.includes(String.fromCharCode(92)) ||
      value.includes(String.fromCharCode(13)) ||
      value.includes(String.fromCharCode(10))) return null;
  return value;
}
