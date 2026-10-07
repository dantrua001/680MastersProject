/** Design tokens: a felt-green table, birch-wood tiles, and the classic premium-square colours. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        tile: ['"Zilla Slab"', 'Georgia', 'serif'],
      },
      colors: {
        felt: { 950: '#0d211d', 900: '#132b26', 800: '#1a3832', 700: '#25493f', 600: '#356357' },
        ink: { 100: '#eaf1ec', 300: '#b4c8be', 500: '#7f9a8e' },
        birch: { 300: '#f6dfa8', 400: '#f2cf85', 500: '#e4b95f', 900: '#2b1d08' },
        coral: { 500: '#e5604d', 600: '#cf4a37' },
        sq: { plain: '#dde5da', tw: '#d9503f', dw: '#ee9d93', tl: '#3b7fbf', dl: '#a6cde6' },
      },
    },
  },
  plugins: [],
};
