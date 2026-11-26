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
        // Official EarlyLearn Hub Brand Palette & AA-Accessible Variants
        'brand-leaf': '#78BD58',
        'brand-leaf-deep': '#2F6F22',
        'brand-leaf-hover': '#265B1B',
        'brand-leaf-tint': '#F1F9EC',
        'brand-yellow': '#FFD34E',
        'brand-yellow-deep': '#8A5B00',
        'brand-yellow-tint': '#FFF8DF',
        'brand-coral': '#F46D70',
        'brand-coral-hover': '#E65A5D',
        'brand-coral-deep': '#C8373D',
        'brand-coral-tint': '#FFF2F2',
        'brand-cream': '#FFFBEA',

        // Shared Civic / MSWDO UI Tokens (Reusable across Auth & Uniform UI Pass)
        'ui-bg': '#FAF7F0',
        'ui-surface': '#FFFFFF',
        'ui-surface-subtle': '#FCFBF7',
        'ui-panel': '#1E3A2F',
        'ui-panel-deep': '#162B23',
        'ui-ink': '#1F2421',
        'ui-ink-secondary': '#4A544E',
        'ui-ink-muted': '#636E67',
        'ui-border': '#E4DFD3',
        'ui-border-strong': '#C8C1B2',
        'ui-focus': '#2F6F22',

        // Semantic Status Tokens (WCAG AA contrast on tint backgrounds)
        'status-error': '#B42318',
        'status-error-bg': '#FEF3F2',
        'status-error-border': '#FECDCA',
        'status-warn': '#934F08',
        'status-warn-bg': '#FFFAEB',
        'status-warn-border': '#FEDF89',
        'status-ok': '#1B663E',
        'status-ok-bg': '#ECFDF3',
        'status-ok-border': '#ABEFC6',

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
        'auth-card': '0 4px 12px rgba(31, 36, 33, 0.04), 0 24px 48px -12px rgba(31, 36, 33, 0.10)',
        'focus-ring': '0 0 0 3px rgba(47, 111, 34, 0.20)',
        'error-ring': '0 0 0 3px rgba(180, 35, 24, 0.16)',
        soft: '0 2px 10px rgba(0,0,0,0.05)',
        bump: '0 6px 0 rgba(0,0,0,0.08)',
        'bump-active': '0 2px 0 rgba(0,0,0,0.12)',
        flat: '0 3px 0 rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'auth-card': '24px',
        'ui-input': '14px',
        'ui-btn': '14px',
      },
    },
  },
  plugins: [],
};
