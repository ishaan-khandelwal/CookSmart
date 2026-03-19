/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./App.{js,jsx,ts,tsx}', './index.js', './src/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
    presets: [require('nativewind/preset')],
    theme: {
        extend: {
            colors: {
                background: '#0f1923',
                primary: '#00C896',
                card: '#1a2535',
                textPrimary: '#FFFFFF',
                textSecondary: '#8892A4',
                danger: '#FF6B6B',
                ink: '#111111',
            },
        },
    },
    plugins: [],
};
