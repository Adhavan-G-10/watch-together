/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#8b5cf6", // Violet 500
        secondary: "#d946ef", // Fuchsia 500
        dark: "#09090b", // Zinc 950
        darker: "#000000", // Pure Black
      }
    },
  },
  plugins: [],
}
