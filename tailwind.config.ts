import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      colors: {
        // Palette calibrée sur le logo Mission Control (fond noir pur + bleu électrique #29D0FE).
        cosmos: {
          950: '#000208', // fond noir du logo
          900: '#060E20',
          800: '#0E1B36',
          700: '#15264D',
        },
        neon: {
          // Clés conservées pour ne pas casser les centaines d'usages Tailwind existants,
          // mais toutes les VALEURS sont maintenant dans la famille bleue du logo —
          // plus aucun mauve ni rose nulle part dans le portail.
          violet: '#29D0FE', // bleu électrique logo (ex-mauve)
          cyan:   '#5EEAFF',
          pink:   '#0A6FD9', // deep blue (ex-rose) — usage quasi nul, sécurité
        },
        mc: {
          electric: '#29D0FE',
          sky:      '#5EEAFF',
          deep:     '#0A6FD9',
          steel:    '#64748B',
          space:    '#000208',
        },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(41, 208, 254, 0.35)' },
          '50%': { boxShadow: '0 0 40px rgba(41, 208, 254, 0.65)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out',
        'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
