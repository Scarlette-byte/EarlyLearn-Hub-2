/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
        baloo: ['Nunito', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
        fraunces: ['Nunito', 'sans-serif'],
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

        // Shared Dashboard UI Tokens (Sage Sidebar + Warm Cream + Peach/Terracotta + Forest)
        'ui-bg': '#FAF5EC',
        'ui-surface': '#FFFFFF',
        'ui-surface-subtle': '#FFF8EE',
        'ui-panel': '#C8DBC6',
        'ui-panel-deep': '#B5CEB2',
        'ui-ink': '#1E2D24',
        'ui-ink-secondary': '#4A5D52',
        'ui-ink-muted': '#677A6E',
        'ui-border': '#E8E0D2',
        'ui-border-strong': '#D2C7B5',
        'ui-focus': '#D96B3B',
        'dash-sage': '#E7F0E6',
        'dash-peach': '#FDECE4',
        'dash-cream': '#FFF8EE',
        'dash-burnt': '#D96B3B',
        'dash-burnt-hover': '#C2592B',
        'dash-forest': '#1E3F2B',
        'dash-forest-deep': '#163020',

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
