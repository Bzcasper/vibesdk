/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './frontend/**/*.{js,ts,jsx,tsx}',
    './frontend/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // Background
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-hover': 'var(--bg-hover)',
        
        // Border
        'border-color': 'var(--border)',
        'border-hover': 'var(--border-hover)',
        
        // Text
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        
        // Platform accents
        'accent-ebay': 'var(--accent-ebay)',
        'accent-shopify': 'var(--accent-shopify)',
        'accent-etsy': 'var(--accent-etsy)',
        'accent-facebook': 'var(--accent-facebook)',
        'accent-pinterest': 'var(--accent-pinterest)',
        'accent-whatnot': 'var(--accent-whatnot)',
        'accent-instagram': 'var(--accent-instagram)',
        'accent-depop': 'var(--accent-depop)',
        'accent-mercari': 'var(--accent-mercari)',
        'accent-poshmark': 'var(--accent-poshmark)',
        
        // System
        'accent-primary': 'var(--accent-primary)',
        'accent-success': 'var(--accent-success)',
        'accent-warning': 'var(--accent-warning)',
        'accent-error': 'var(--accent-error)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'Monaco',
          'Inconsolata',
          'Fira Mono',
          'Droid Sans Mono',
          'Source Code Pro',
          'monospace',
        ],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
