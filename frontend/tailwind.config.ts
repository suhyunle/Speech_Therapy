import type { Config } from 'tailwindcss';

// 디자인 캔버스 '말랑말랑' 색 · 글꼴 토큰
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F5F3FC',
        ink: '#1B1A33',
        sub: '#4A4866',
        muted: '#5D5B76',
        faint: '#8E8BA8',
        line: '#E6E3F2',
        line2: '#CFCBE3',
        tint: '#F0EEF8',
        brand: { DEFAULT: '#5B4BFF', dark: '#3F31D6', deep: '#2A1FA8', soft: '#ECEAFF', light: '#DCD8FF', mid: '#7F72FF', border: '#C9C3FF' },
        pass: { DEFAULT: '#14A06E', dark: '#0E7A53', soft: '#DDF7EC', ink: '#0B4F33', text: '#0B6B44', range: '#C9F0DF' },
        lime: { DEFAULT: '#D4F2A0', dark: '#A6D46A', ink: '#2F5A00' },
        coral: { DEFAULT: '#FF6B3D', dark: '#D9481A', ink: '#A8370F', soft: '#FFF6F1', light: '#FFB79C' },
        wind: '#FF8A66',
        cheek: '#FF8AA0',
        kakao: '#FEE500',
      },
      fontFamily: {
        jua: ['Jua', 'sans-serif'],
        sans: ['"Noto Sans KR"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        btn: '0 5px 0 #3F31D6',
        card: '0 5px 0 #E6E3F2',
        chip: '0 3px 0 #E6E3F2',
        pass: '0 3px 0 #0E7A53',
        coral: '0 3px 0 #D9481A',
        node: '0 6px 0 #3F31D6',
      },
    },
  },
  plugins: [],
};
export default config;
