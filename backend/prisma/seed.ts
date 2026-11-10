/**
 * 시드 데이터. 출처: 디자인 캔버스 '테스트 단어 · 문장 설계' 보드 (Stimuli).
 * - 보드에 있는 문항(무의미 음절 39+, 단어 30, 문장 12, 문단 1, 소리별 단어 은행)은 status=REVIEWED (설계 확정본)
 *   ※ 보드의 '다음에 정할 것'처럼 언어재활사 검토는 아직이라 source에 그대로 적어둔다.
 * - 연습 단어가 부족한 소리를 채운 단어는 status=DRAFT, source='앱 작성 · 검토 전' (관리자 화면에서 검토)
 */
import 'dotenv/config';
import { ItemKind, ItemStatus, PrismaClient, Role, SoundKind } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const BOARD = '디자인 Stimuli 보드 · 언어재활사 검토 전';
const DRAFT = '앱 작성 · 검토 전';

type G = { place: string; manner: string; voicing: string; cue: string; steps: string[]; compare?: { symbol: string; text: string } };
const C = (place: string, manner: string, voicing: string, cue: string, steps: string[], compare?: G['compare']): G => ({ place, manner, voicing, cue, steps, compare });

// 자음 19 (SoundMap: 입술 · 잇몸 · 센입천장 · 여린입천장 · 목청)
const CONSONANTS: [string, string, G][] = [
  ['ㅅ', 'fric', C('잇몸소리', '새는 바람 소리', '목 떨림 없음', '스', ['혀끝을 윗잇몸 바로 아래로, 닿지 않게', '목 → 틈 → 앞니 사이로 쉬익', '가늘고 길게, 끊기지 않고 새어 나와요'], { symbol: 'ㅊ', text: '츠! 혀로 막았다가 팍! 짧게 터지면 ㅊ이에요' })],
  ['ㅆ', 'fric', C('잇몸소리', '센 바람 소리', '목 떨림 없음', '쓰', ['ㅅ과 같은 자리에 혀끝을 둬요', '목에 힘을 주고', '바람을 세게, 짧고 단단하게'], { symbol: 'ㅅ', text: 'ㅅ은 부드럽게, ㅆ은 목에 힘을 줘요' })],
  ['ㄱ', 'stop', C('여린입천장소리', '막았다 터지는 소리', '목 떨림 없음', '그', ['혀 뒤쪽을 입천장 안쪽 말랑한 곳에 붙여요', '잠깐 막아요', '살짝 떼요'], { symbol: 'ㅋ', text: 'ㅋ은 뗄 때 바람이 세게 나와요' })],
  ['ㄲ', 'stop', C('여린입천장소리', '단단하게 터지는 소리', '목 떨림 없음', '끄', ['혀 뒤를 붙여요', '목에 힘을 줘요', '바람 없이 단단하게 떼요'], { symbol: 'ㄱ', text: 'ㄱ보다 목에 힘이 들어가요' })],
  ['ㅋ', 'stop', C('여린입천장소리', '바람이 세게 터지는 소리', '목 떨림 없음', '크', ['혀 뒤를 붙여요', '숨을 모아요', '떼면서 바람을 세게'], { symbol: 'ㄱ', text: 'ㄱ은 바람이 약해요' })],
  ['ㄷ', 'stop', C('잇몸소리', '막았다 터지는 소리', '목 떨림 없음', '드', ['혀끝을 윗잇몸에 붙여요', '잠깐 막아요', '살짝 떼요'], { symbol: 'ㅅ', text: 'ㅅ은 막지 않고 틈으로 바람을 내요' })],
  ['ㄸ', 'stop', C('잇몸소리', '단단하게 터지는 소리', '목 떨림 없음', '뜨', ['혀끝을 붙여요', '목에 힘을 줘요', '바람 없이 떼요'], { symbol: 'ㄷ', text: 'ㄷ보다 목에 힘이 들어가요' })],
  ['ㅌ', 'stop', C('잇몸소리', '바람이 세게 터지는 소리', '목 떨림 없음', '트', ['혀끝을 붙여요', '숨을 모아요', '떼면서 바람을 세게'], { symbol: 'ㄷ', text: 'ㄷ은 바람이 약해요' })],
  ['ㅂ', 'stop', C('입술소리', '막았다 터지는 소리', '목 떨림 없음', '브', ['두 입술을 붙여요', '잠깐 막아요', '살짝 떼요'], { symbol: 'ㅁ', text: 'ㅁ은 입술을 붙인 채 코로 소리가 나요' })],
  ['ㅃ', 'stop', C('입술소리', '단단하게 터지는 소리', '목 떨림 없음', '쁘', ['입술을 꽉 붙여요', '목에 힘을 줘요', '바람 없이 떼요'], { symbol: 'ㅂ', text: 'ㅂ보다 입술과 목에 힘이 들어가요' })],
  ['ㅍ', 'stop', C('입술소리', '바람이 세게 터지는 소리', '목 떨림 없음', '프', ['입술을 붙여요', '숨을 모아요', '손바닥에 바람이 닿게 터뜨려요'], { symbol: 'ㅂ', text: 'ㅂ은 손바닥에 바람이 거의 안 닿아요' })],
  ['ㅈ', 'stop', C('센입천장소리', '붙였다 비비며 떼는 소리', '목 떨림 없음', '즈', ['혓바닥을 잇몸 뒤 딱딱한 입천장에 붙여요', '살짝 떼며', '바람을 흘려요'], { symbol: 'ㅅ', text: 'ㅅ은 붙이지 않고 바람만 내요' })],
  ['ㅉ', 'stop', C('센입천장소리', '단단하게 비비는 소리', '목 떨림 없음', '쯔', ['ㅈ처럼 붙여요', '목에 힘을 줘요', '바람 없이 떼요'], { symbol: 'ㅈ', text: 'ㅈ보다 목에 힘이 들어가요' })],
  ['ㅊ', 'stop', C('센입천장소리', '바람이 세게 비비는 소리', '목 떨림 없음', '츠', ['ㅈ처럼 붙여요', '숨을 모아요', '떼면서 바람을 세게'], { symbol: 'ㅅ', text: 'ㅅ은 막지 않고 길게 새어 나와요' })],
  ['ㅁ', 'stop', C('입술소리', '코로 울리는 소리', '목 떨림 있음', '므', ['입술을 다물어요', '코로 소리를 내요', '콧등에 손을 대면 떨려요'], { symbol: 'ㅂ', text: 'ㅂ은 코가 떨리지 않아요' })],
  ['ㄴ', 'stop', C('잇몸소리', '코로 울리는 소리', '목 떨림 있음', '느', ['혀끝을 윗잇몸에 대요', '코로 소리를 내요', '콧등이 떨려요'], { symbol: 'ㄷ', text: 'ㄷ은 코가 떨리지 않아요' })],
  ['ㄹ', 'stop', C('잇몸소리', '혀끝을 튕기는 소리', '목 떨림 있음', '르', ['혀끝을 윗잇몸에 가볍게', '톡 튕겨요', '받침이면 붙인 채 옆으로 소리를'], { symbol: 'ㄴ', text: 'ㄴ은 코로 소리가 나요' })],
  ['ㅇ', 'stop', C('여린입천장소리', '코로 울리는 받침 소리', '목 떨림 있음', '응', ['받침에서만 소리가 나요', '혀 뒤를 입천장 안쪽에 대요', '코로 소리를 내요'], { symbol: 'ㄴ', text: 'ㄴ 받침은 혀끝이 윗잇몸에 닿아요' })],
  ['ㅎ', 'stop', C('목청소리', '목에서 숨을 내쉬는 소리', '목 떨림 없음', '흐', ['입을 벌려요', '목 깊은 곳에서', '숨을 내쉬듯 바람만'], { symbol: 'ㅇ', text: '모음 사이 ㅎ은 약하게 나도 괜찮아요' })],
];

const V = (cue: string, mouth: string, tongue: string, lips: string): G => ({ place: mouth, manner: tongue, voicing: lips, cue, steps: [mouth, tongue, lips] });
// 단모음 10 (LearnOrder 1단계) · 이중모음 11 (2단계)
const VOWELS: [string, SoundKind, G][] = [
  ['ㅣ', SoundKind.VOWEL, V('이', '입을 조금만 벌려요', '혀를 앞쪽 위로', '입술을 옆으로 펴요')],
  ['ㅏ', SoundKind.VOWEL, V('아', '입을 크게 벌려요', '혀를 아래로', '입술은 편하게')],
  ['ㅜ', SoundKind.VOWEL, V('우', '입을 조금 벌려요', '혀를 뒤쪽 위로', '입술을 작게 모아 앞으로')],
  ['ㅓ', SoundKind.VOWEL, V('어', 'ㅏ보다 조금 덜 벌려요', '혀를 뒤쪽 가운데로', '입술을 둥글게 하지 않아요')],
  ['ㅗ', SoundKind.VOWEL, V('오', '입을 조금 벌려요', '혀를 뒤쪽 가운데로', '입술을 동그랗게')],
  ['ㅡ', SoundKind.VOWEL, V('으', '입을 조금만 벌려요', '혀를 가운데 위로', '입술을 옆으로')],
  ['ㅔ', SoundKind.VOWEL, V('에', '입을 조금 벌려요', '혀를 앞쪽 가운데로', '입술은 편하게')],
  ['ㅐ', SoundKind.VOWEL, V('애', '입을 조금 벌려요 (ㅔ와 같게 봐요)', '혀를 앞쪽 가운데로', '입술은 편하게')],
  ['ㅚ', SoundKind.VOWEL, V('외', 'ㅗ에서 시작해요', '혀를 앞으로', '[웨]로 나도 괜찮아요')],
  ['ㅟ', SoundKind.VOWEL, V('위', 'ㅜ에서 시작해요', 'ㅣ로 이어요', '입술 모았다가 펴요')],
  ['ㅑ', SoundKind.DIPHTHONG, V('야', 'ㅣ에서 시작해요', 'ㅏ로 이어요', '짧게 미끄러지듯')],
  ['ㅕ', SoundKind.DIPHTHONG, V('여', 'ㅣ에서 시작해요', 'ㅓ로 이어요', '짧게 미끄러지듯')],
  ['ㅛ', SoundKind.DIPHTHONG, V('요', 'ㅣ에서 시작해요', 'ㅗ로 이어요', '입술을 동그랗게')],
  ['ㅠ', SoundKind.DIPHTHONG, V('유', 'ㅣ에서 시작해요', 'ㅜ로 이어요', '입술을 모아 앞으로')],
  ['ㅒ', SoundKind.DIPHTHONG, V('얘', 'ㅣ에서 시작해요', 'ㅐ로 이어요', 'ㅖ와 같게 봐요')],
  ['ㅖ', SoundKind.DIPHTHONG, V('예', 'ㅣ에서 시작해요', 'ㅔ로 이어요', '자음 뒤에선 [ㅔ]도 괜찮아요')],
  ['ㅘ', SoundKind.DIPHTHONG, V('와', 'ㅗ에서 시작해요', 'ㅏ로 이어요', '입술 모았다가 벌려요')],
  ['ㅝ', SoundKind.DIPHTHONG, V('워', 'ㅜ에서 시작해요', 'ㅓ로 이어요', '입술 모았다가 벌려요')],
  ['ㅙ', SoundKind.DIPHTHONG, V('왜', 'ㅗ에서 시작해요', 'ㅐ로 이어요', 'ㅚ·ㅞ와 같게 봐요')],
  ['ㅞ', SoundKind.DIPHTHONG, V('웨', 'ㅜ에서 시작해요', 'ㅔ로 이어요', 'ㅚ·ㅙ와 같게 봐요')],
  ['ㅢ', SoundKind.DIPHTHONG, V('의', 'ㅡ에서 시작해요', 'ㅣ로 이어요', '첫음절 [의] · 그 외 [이]도 괜찮아요')],
];

// 무의미 음절 39 (Stimuli 4장) + 진단용 모음 ㅑ ㅕ ㅛ ㅠ (PlacementSyllable: 아 야 어 여 오 요 우 유 으 이)
const SYLLABLES = '가 까 카 다 따 타 바 빠 파 자 짜 차 사 싸 마 나 라 하 악 안 앋 알 암 압 앙 아 어 오 우 으 이 에 야 여 요 유 와 워 의'.split(' ');
const PLACEMENT_SYLLABLES = '가 나 다 라 마 바 사 자 차 카 타 파 하 아 야 어 여 오 요 우 유 으 이'.split(' ');

// 단어 30 (Stimuli 5장): [단어, 보는 소리, 메모]
const WORDS: [string, string[], string][] = [
  ['가방', ['ㄱ', 'ㅇ'], 'ㄱ 첫소리 · ㅇ 받침'], ['고기', ['ㄱ'], 'ㄱ 가운데'], ['꼬리', ['ㄲ'], 'ㄲ'], ['쿠키', ['ㅋ', 'ㅜ'], 'ㅋ · ㅜ'],
  ['다리', ['ㄷ'], 'ㄷ'], ['바다', ['ㄷ'], 'ㄷ 가운데'], ['딸기', ['ㄸ', 'ㄹ'], 'ㄸ · ㄹ 받침'], ['토끼', ['ㅌ', 'ㄲ'], 'ㅌ · ㄲ 가운데'],
  ['바지', ['ㅂ', 'ㅈ'], 'ㅂ · ㅈ 가운데'], ['오빠', ['ㅃ'], 'ㅃ'], ['포도', ['ㅍ'], 'ㅍ'], ['자두', ['ㅈ'], 'ㅈ'], ['가짜', ['ㅉ'], 'ㅉ'],
  ['치마', ['ㅊ', 'ㅁ'], 'ㅊ · ㅁ 가운데'], ['사자', ['ㅅ'], 'ㅅ 첫소리'], ['가수', ['ㅅ'], 'ㅅ 가운데'], ['소리', ['ㅅ', 'ㄹ'], 'ㅅ · ㄹ 가운데'],
  ['씨름', ['ㅆ', 'ㅡ', 'ㅁ'], 'ㅆ · ㅡ · ㅁ 받침'], ['하마', ['ㅎ'], 'ㅎ'], ['나비', ['ㄴ'], 'ㄴ'], ['라면', ['ㄹ', 'ㅕ', 'ㄴ'], 'ㄹ 첫소리 · ㅕ · ㄴ 받침'],
  ['거미', ['ㅓ'], 'ㅓ'], ['수박', ['ㄱ'], 'ㄱ 받침'], ['그네', ['ㅡ', 'ㅔ'], 'ㅡ · ㅔ'], ['우유', ['ㅜ', 'ㅠ'], 'ㅜ · ㅠ'], ['야구', ['ㅑ'], 'ㅑ'],
  ['요리', ['ㅛ'], 'ㅛ'], ['사과', ['ㅘ', 'ㅅ'], 'ㅘ'], ['의자', ['ㅢ'], 'ㅢ'], ['가위', ['ㅟ'], 'ㅟ'],
];
const PLACEMENT_WORDS = ['가방', '나비', '다리', '사과', '라면', '하마', '자두', '치마']; // PlacementIntro: 8개

// 문장 12 (Stimuli 7장): [문장, 표준 발음, 보는 소리, 억양]
const SENTENCES: [string, string, string[], 'down' | 'up'][] = [
  ['사과가 정말 싸요.', '사과가 정말 싸요', ['ㅅ', 'ㅆ', 'ㅈ'], 'down'],
  ['딸기를 같이 먹어요.', '딸기를 가치 머거요', ['ㄸ', 'ㅊ'], 'down'],
  ['바다에 배가 떠요.', '바다에 배가 떠요', ['ㅂ', 'ㄷ', 'ㄸ'], 'down'],
  ['버스가 빨리 와요.', '버스가 빨리 와요', ['ㅃ', 'ㅅ', 'ㅘ', 'ㅓ'], 'down'],
  ['커피를 좀 주세요.', '커피를 좀 주세요', ['ㅋ', 'ㅍ', 'ㅈ'], 'down'],
  ['토끼가 풀을 먹어요.', '토끼가 푸를 머거요', ['ㅌ', 'ㄲ', 'ㅍ'], 'down'],
  ['아이가 자고 있어요.', '아이가 자고 이써요', ['ㅈ', 'ㅆ'], 'down'],
  ['오늘 날씨가 좋아요.', '오늘 날씨가 조아요', ['ㄹ', 'ㅆ'], 'down'],
  ['우리 엄마는 의사예요.', '우리 엄마는 의사예요', ['ㅢ', 'ㅁ'], 'down'],
  ['물을 천천히 마셔요.', '무를 천천히 마셔요', ['ㅊ', 'ㅅ'], 'down'],
  ['어디에 가고 있어요?', '어디에 가고 이써요', ['ㅓ', 'ㄷ'], 'up'],
  ['점심 밥 먹었어요?', '점심 밤 머거써요', ['ㅁ', 'ㅂ'], 'up'],
];
const PLACEMENT_SENTENCES = [0, 3, 10]; // 첫 진단은 1 · 4 · 11번

const PARAGRAPH =
  '우리 집 앞 공원에는 작은 의자가 있어요. 아침마다 할머니와 강아지가 같이 산책하며 이야기를 해요. 비가 오는 날에는 빨간 우산을 쓰고, 맑은 날에는 토끼풀 사이를 뛰어다녀요. 저녁에는 짜장면을 먹고 따뜻한 우유를 마셔요. 내일은 친구와 쿠키를 구워 보기로 했어요.';
const PARAGRAPH_PRON =
  '우리 집 압 공워네는 자근 의자가 이써요 아침마다 할머니와 강아지가 가치 산채카며 이야기를 해요 비가 오는 나레는 빨간 우사늘 쓰고 말근 나레는 토끼풀 사이를 뛰어다녀요 저녀게는 짜장며늘 먹꼬 따뜨탄 우유를 마셔요 내이른 친구와 쿠키를 구워 보기로 해써요';

// 소리별 연습 단어 은행 — Stimuli 9장(보드 확정본) + 부족한 소리 채우기(DRAFT)
const BANK_BOARD: Record<string, { baseline: string[]; bank: string[] }> = {
  ㅅ: { baseline: ['사과', '소리', '수박'], bank: ['사자', '가수', '버스', '의사', '수영', '소금', '세수', '모서리'] },
  ㅓ: { baseline: ['거미', '어머니', '버스'], bank: ['머리', '서울', '어디', '너구리', '허리', '거울'] },
  ㅂ: { baseline: ['불'], bank: ['바다', '바지'] },
  ㅃ: { baseline: ['뿔'], bank: ['오빠', '빨래'] },
  ㅍ: { baseline: ['풀'], bank: ['포도', '우표'] },
};
const BANK_DRAFT: Record<string, string[]> = {
  ㅏ: ['아기', '나라', '바나나'], ㅐ: ['개', '배', '새우'], ㅔ: ['게', '네모', '메뚜기'], ㅗ: ['오이', '소', '도토리'], ㅚ: ['회사', '외투', '참외'],
  ㅜ: ['구두', '누나', '두부'], ㅟ: ['귀', '쥐', '바위'], ㅡ: ['크다', '쓰기', '드럼'], ㅣ: ['기차', '미소', '비누'],
  ㅑ: ['야옹', '야자', '이야기'], ㅒ: ['얘기', '걔', '얘들아'], ㅕ: ['여우', '겨울', '벼'], ㅖ: ['예쁘다', '시계', '계단'], ㅘ: ['과자', '화가', '와요'],
  ㅙ: ['돼지', '왜', '괜찮아'], ㅛ: ['교실', '효자', '우표'], ㅝ: ['뭐', '원숭이', '더워'], ㅞ: ['궤도', '스웨터', '꿰매다'], ㅠ: ['유리', '휴지', '귤'], ㅢ: ['의사', '의미', '의견'],
  ㄱ: ['기차', '고래', '구두'], ㄲ: ['까치', '꿀', '꽃'], ㅋ: ['코', '키', '카드'], ㄷ: ['두부', '도시', '구두'], ㄸ: ['따다', '떡', '뚜껑'], ㅌ: ['타조', '투수', '기타'],
  ㅂ: ['비누', '보리'], ㅃ: ['빵'], ㅍ: ['파도', '피아노'], ㅈ: ['주스', '지도', '모자'], ㅉ: ['짜다', '찌개', '쪽지'], ㅊ: ['기차', '차도', '고추'],
  ㅆ: ['쌀', '아저씨', '싸다'], ㅎ: ['호수', '허리', '휴지'], ㄴ: ['누나', '나무', '노래'], ㄹ: ['노래', '고래', '오리'], ㅁ: ['머리', '모자', '엄마'], ㅇ: ['공', '사랑', '강아지'],
};
const PRON_EXCEPTIONS: Record<string, string> = { 괜찮아: '괜차나', 쪽지: '쪽찌', 꽃: '꼳', 떡: '떡', 얘들아: '얘드라', 꿰매다: '꿰매다' };

function syllableTargets(s: string): string[] {
  const code = s.charCodeAt(0) - 0xac00;
  const on = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(code / 588)];
  const vo = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'[Math.floor((code % 588) / 28)];
  const co = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'][code % 28];
  if (co) return [co];
  return on === 'ㅇ' ? [vo] : [on];
}

async function main() {
  // 소리
  let order = 0;
  for (const [symbol, kind, g] of VOWELS) {
    const groupKey = kind === SoundKind.VOWEL ? 'vowel' : 'diphthong';
    await prisma.sound.upsert({ where: { symbol }, create: { symbol, kind, groupKey, orderIndex: order++, place: g.place, manner: g.manner, voicing: g.voicing, cue: g.cue, guide: g as any }, update: { guide: g as any, orderIndex: order - 1 } });
  }
  for (const [symbol, groupKey, g] of CONSONANTS) {
    await prisma.sound.upsert({ where: { symbol }, create: { symbol, kind: SoundKind.CONSONANT, groupKey, orderIndex: order++, place: g.place, manner: g.manner, voicing: g.voicing, cue: g.cue, guide: g as any }, update: { guide: g as any, orderIndex: order - 1 } });
  }

  if ((await prisma.lessonItem.count()) === 0) {
    const items: any[] = [];
    SYLLABLES.forEach((s) => {
      const pi = PLACEMENT_SYLLABLES.indexOf(s);
      items.push({ kind: ItemKind.SYLLABLE, text: s, pronunciation: s, targetSounds: syllableTargets(s), placement: pi >= 0, placementOrder: pi >= 0 ? pi : null, status: ItemStatus.REVIEWED, source: BOARD });
    });
    // 단어: 보드 30개 + 은행 → 하나의 단어는 한 번만, 보는 소리는 합친다
    const words = new Map<string, { sounds: Set<string>; note?: string; status: ItemStatus; baselineFor?: string }>();
    const addWord = (w: string, s: string, status: ItemStatus, note?: string, baselineFor?: string) => {
      const cur = words.get(w) ?? { sounds: new Set<string>(), note, status, baselineFor };
      cur.sounds.add(s);
      if (status === ItemStatus.REVIEWED) cur.status = ItemStatus.REVIEWED;
      if (note && !cur.note) cur.note = note;
      if (baselineFor && !cur.baselineFor) cur.baselineFor = baselineFor;
      words.set(w, cur);
    };
    for (const [w, sounds, note] of WORDS) sounds.forEach((s) => addWord(w, s, ItemStatus.REVIEWED, note));
    for (const [s, b] of Object.entries(BANK_BOARD)) {
      b.baseline.forEach((w) => addWord(w, s, ItemStatus.REVIEWED, undefined, s));
      b.bank.forEach((w) => addWord(w, s, ItemStatus.REVIEWED));
    }
    for (const [s, ws] of Object.entries(BANK_DRAFT)) ws.forEach((w) => addWord(w, s, ItemStatus.DRAFT));
    for (const [w, v] of words) {
      const pi = PLACEMENT_WORDS.indexOf(w);
      items.push({
        kind: ItemKind.WORD, text: w, pronunciation: PRON_EXCEPTIONS[w] ?? w, targetSounds: [...v.sounds], note: v.note ?? null,
        placement: pi >= 0, placementOrder: pi >= 0 ? 100 + pi : null, baselineFor: v.baselineFor ?? null,
        status: v.status, source: v.status === ItemStatus.REVIEWED ? BOARD : DRAFT, difficulty: w.length > 2 ? 2 : 1,
      });
    }
    SENTENCES.forEach(([text, pron, sounds, intonation], i) => {
      const pi = PLACEMENT_SENTENCES.indexOf(i);
      items.push({ kind: ItemKind.SENTENCE, text, pronunciation: pron, targetSounds: sounds, intonation, placement: pi >= 0, placementOrder: pi >= 0 ? 200 + pi : null, status: ItemStatus.REVIEWED, source: BOARD, difficulty: 3 });
    });
    items.push({ kind: ItemKind.PARAGRAPH, text: PARAGRAPH, pronunciation: PARAGRAPH_PRON, targetSounds: [], status: ItemStatus.DRAFT, source: `${BOARD} · 표준 발음은 앱이 만든 초안`, difficulty: 5 });
    await prisma.lessonItem.createMany({ data: items });
    console.log(`items: ${items.length}`);
  }

  await ensureExercises();
  await ensureBaselines();

  const id = process.env.ADMIN_LOGIN_ID;
  const pw = process.env.ADMIN_PASSWORD;
  if (id && pw && !(await prisma.user.findUnique({ where: { loginId: id } }))) {
    await prisma.user.create({ data: { loginId: id, passwordHash: await argon2.hash(pw, { type: argon2.argon2id }), name: '관리자', role: Role.ADMIN, settings: { create: {} }, streak: { create: {} } } });
    console.log(`admin: ${id}`);
  }
  console.log(`sounds: ${await prisma.sound.count()}`);
}

/** 발성 · 억양 · 길이 · 쉬익 연습 문항 (디자인 VoiceForward · EndClear · Intonation · Timing · SMeter · WebVoice) — 없을 때만 넣는다 */
const EXERCISES: { exercise: string; kind: ItemKind; text: string; pronunciation: string; intonation?: 'up' | 'down'; note: string; targetSounds?: string[] }[] = [
  { exercise: 'forward', kind: ItemKind.SYLLABLE, text: '음——', pronunciation: '음', note: '입술을 가볍게 다물고 3초' },
  { exercise: 'forward', kind: ItemKind.WORD, text: '음—마', pronunciation: '음마', note: '입술 앞에서 울림을 느끼며' },
  { exercise: 'forward', kind: ItemKind.WORD, text: '마미무', pronunciation: '마미무', note: '입술을 또박또박' },
  { exercise: 'endclear', kind: ItemKind.SENTENCE, text: '사과를 세 개 샀어요.', pronunciation: '사과를 세 개 사써요', note: '마지막 글자까지 숨을 남겨요' },
  { exercise: 'endclear', kind: ItemKind.WORD, text: '감사합니다', pronunciation: '감사함니다', note: '‘니다’까지 크게' },
  { exercise: 'intonation', kind: ItemKind.SENTENCE, text: '밥 먹었어?', pronunciation: '밥 머거써', intonation: 'up', note: '묻는 말 ↗ 끝을 올려요' },
  { exercise: 'intonation', kind: ItemKind.SENTENCE, text: '밥 먹었어.', pronunciation: '밥 머거써', intonation: 'down', note: '말하는 말 ↘ 끝을 내려요' },
  { exercise: 'intonation', kind: ItemKind.SENTENCE, text: '어디에 가고 있어요?', pronunciation: '어디에 가고 이써요', intonation: 'up', note: '묻는 말 ↗' },
  { exercise: 'timing', kind: ItemKind.SENTENCE, text: '학교에 가요', pronunciation: '학꾜에 가요', note: '글자마다 짧게 끊어요' },
  { exercise: 'timing', kind: ItemKind.SENTENCE, text: '오늘 날씨가 좋아요', pronunciation: '오늘 날씨가 조아요', note: '고르게, 길게 끌지 않기' },
  { exercise: 'hiss', kind: ItemKind.SYLLABLE, text: '스—', pronunciation: '스', note: '가늘고 길게 쉬익—', targetSounds: ['ㅅ'] },
];

async function ensureExercises() {
  for (const e of EXERCISES) {
    const exists = await prisma.lessonItem.findFirst({ where: { exercise: e.exercise, text: e.text } });
    if (exists) continue;
    await prisma.lessonItem.create({
      data: { kind: e.kind, text: e.text, pronunciation: e.pronunciation, targetSounds: e.targetSounds ?? [], exercise: e.exercise, intonation: e.intonation, note: e.note, status: ItemStatus.REVIEWED, source: '디자인 발성·억양 보드', difficulty: 2 },
    });
  }
}

/** 새 소리 시작 전 기초선 단어 3개 (Stimuli: 3개 × 3번). 보드에 없는 소리는 그 소리의 첫 단어 3개로 정한다. */
async function ensureBaselines() {
  const sounds = await prisma.sound.findMany();
  for (const s of sounds) {
    const have = await prisma.lessonItem.count({ where: { baselineFor: s.symbol } });
    if (have >= 3) continue;
    const words = await prisma.lessonItem.findMany({
      where: { kind: ItemKind.WORD, targetSounds: { has: s.symbol }, baselineFor: null, exercise: null },
      orderBy: [{ status: 'desc' }, { difficulty: 'asc' }, { text: 'asc' }],
      take: 3 - have,
    });
    for (const w of words) await prisma.lessonItem.update({ where: { id: w.id }, data: { baselineFor: s.symbol } });
  }
}

main().finally(() => prisma.$disconnect());
