/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        baloo: ['"Baloo 2"', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
        fraunces: ['Fraunces', 'serif'],
      },
      colors: {
        // Auth (login / sign up) palette
        sky: '#6EC6FF',
        'sky-deep': '#3FA9F5',
        sun: '#FFD93D',
        leaf: '#6BCB77',
        coral: '#FF6B6B',
        'coral-deep': '#F4495C',
        cream: '#FFFDF7',
        ink: '#2B2B2B',
        'ink-soft': '#6b6b6b',

        // Admin / Teacher dashboard palette
        dashbg: '#FAF5EC',
        sidebar: '#3D3327',
        'sidebar-text': '#C7B99E',
        accent: '#C9784A',
        gold: '#F0C46B',
        'dash-ink': '#2E271C',
        'dash-ink-soft': '#7A6B52',
        'card-border': '#F1E9DA',
        danger: '#C9553F',

        // Student dashboard palette
        turquoise: '#3DC1D3',
        purple: '#9B7EDE',
        orange: '#FFA94D',
      },
      boxShadow: {
        card: '0 1px 3px rgba(60,45,20,0.06), 0 8px 20px rgba(60,45,20,0.04)',
        soft: '0 2px 10px rgba(0,0,0,0.05)',
        bump: '0 6px 0 rgba(0,0,0,0.08)',
        'bump-active': '0 2px 0 rgba(0,0,0,0.12)',
        flat: '0 3px 0 rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
