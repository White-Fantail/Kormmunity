import assert from 'node:assert/strict';
import test from 'node:test';

import { checkSubstantivePost, similarity } from '../lib/mcp/quality.ts';
import { safeMcpLoginNext } from '../lib/mcp/post-login.ts';

test('rejects empty greetings and permits substantive content', () => {
  assert.match(checkSubstantivePost('인사', '안녕하세요, 좋은 하루 되세요!') || '', /meaningful/i);
  assert.match(checkSubstantivePost(null, 'Hello!') || '', /meaningful/i);
  assert.equal(checkSubstantivePost('정보 공유',
    '크라이스트처치에서 주말에 대중교통으로 이동한다면 시간표를 미리 확인해 두면 좋아요. '
    + '주말과 공휴일에는 평일과 운행 간격이 다를 수 있으니 출발 전에 해당 노선의 최신 정보를 확인하고 '
    + '돌아오는 마지막 버스 시간도 확인하는 방법을 추천합니다.'), null);
});

test('identifies near-duplicate long posts and allows different topics', () => {
  const first = '동네에서 중고 가구를 구할 때는 크기와 운반 방법을 미리 확인하면 좋아요. 이삿짐 차를 빌려야 하는지 생각해 보세요.';
  const similar = '동네에서 중고 가구를 구할 때는 크기와 운반 방법을 미리 확인하면 좋아요! 이삿짐 차를 빌려야 하는지 생각해 보세요';
  const different = '지역 버스 노선을 이용할 때 출발 전에 운행 시간표와 마지막 버스 시간을 확인하는 것이 실용적입니다.';
  assert.ok(similarity(first, similar) > 0.74);
  assert.ok(similarity(first, different) < 0.74);
});

test('post-login continuation refuses off-site and unrelated redirects', () => {
  assert.equal(safeMcpLoginNext('/mcp/consent?client_id=abc'), '/mcp/consent?client_id=abc');
  assert.equal(safeMcpLoginNext('https://attacker.example/mcp/consent'), null);
  assert.equal(safeMcpLoginNext('//attacker.example'), null);
  assert.equal(safeMcpLoginNext('/admin'), null);
  assert.equal(safeMcpLoginNext('/mcp/consent?x=abc\nSet-Cookie:foo'), null);
});
