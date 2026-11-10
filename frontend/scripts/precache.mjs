// 빌드 뒤 실행: 인터넷 없이도 열 수 있게 서비스 워커가 미리 받아 둘 목록(public/precache.json)을 만든다.
// 화면 껍데기(HTML) + 자바스크립트·CSS. 글꼴(16MB 넘음)은 미리 받지 않고 쓸 때 저장한다.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = new URL('..', import.meta.url).pathname;
const next = join(root, '.next');
const buildId = readFileSync(join(next, 'BUILD_ID'), 'utf8').trim();
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const assets = walk(join(next, 'static'))
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => '/_next/static/' + f.slice(join(next, 'static').length + 1).split('\\').join('/'))
  // 브라우저는 [symbol] 같은 폴더 이름을 %5B…%5D 로 요청한다 → 같은 주소로 저장
  .map((u) => u.replace(/\[/g, '%5B').replace(/\]/g, '%5D'));

// 로그인 없이 · 로그인 뒤 쓰는 화면 중 주소에 변수가 없는 것 (관리자·OAuth 돌아오는 곳 제외)
const routes = Object.values(JSON.parse(readFileSync(join(next, 'app-path-routes-manifest.json'), 'utf8')))
  .filter((r) => !r.includes('[') && !['/_not-found', '/admin'].includes(r));
// 소리 레슨 40개 · 발성 연습 4개는 주소에 소리 이름이 들어간다
const SOUNDS = 'ㅏㅓㅗㅜㅡㅣㅔㅐㅚㅟㅑㅕㅛㅠㅒㅖㅘㅝㅙㅞㅢㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
const dynamic = [...SOUNDS.map((s) => `/learn/${encodeURIComponent(s)}`), ...['forward', 'endclear', 'intonation', 'timing'].map((k) => `/voice/${k}`)];

const urls = [...new Set([...routes, ...dynamic, ...assets, '/manifest.webmanifest', '/icon-192.png', '/logo.svg', '/favicon.svg', ...readdirSync(join(root, 'public', 'diagrams')).map((f) => `/diagrams/${f}`)])];
writeFileSync(join(root, 'public', 'precache.json'), JSON.stringify({ version: buildId, urls }));
console.log(`precache.json: ${urls.length}개 (화면 ${routes.length + dynamic.length} · 파일 ${assets.length})`);
