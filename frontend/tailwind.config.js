export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0a',
        surface: '#111111',
        elevated: '#1a1a1a',
        hover: '#202020',
        accent: '#e8ff47',
        'border-subtle': '#1f1f1f',
        'border-default': '#2a2a2a',
        'text-primary': '#f0f0f0',
        'text-secondary': '#888888',
        'text-tertiary': '#555555',
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
