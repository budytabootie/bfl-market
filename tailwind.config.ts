// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bfl: {
          bg: '#050816',        // dark background
          card: '#0f172a',      // slate-900-ish
          primary: '#22c55e',   // emerald-500
          primarySoft: '#4ade80',
          accent: '#38bdf8',    // sky-400
        },
      },
      boxShadow: {
        'bfl-card': '0 18px 45px rgba(0,0,0,0.45)',
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;