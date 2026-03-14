export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0F172A',
          card: '#1E293B',
          accent: '#3B82F6',
          text: '#F8FAFC',
          muted: '#94A3B8'
        }
      }
    },
  },
  plugins: [],
}
