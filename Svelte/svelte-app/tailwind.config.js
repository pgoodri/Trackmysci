import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
const config = {
    content: ["./src/**/*.{html,js,svelte,ts}"],
    theme: {
        container: {
            center: true,
            padding: "2rem",
        },
        extend: {
            colors: {
                transparent: "transparent",
                black: "#000000",
                white: "#ffffff",
                gray: {
                    100: "#f3f4f6",
                    900: "#111827",
                },
                blue: {
                    500: "#3b82f6",
                },
            },
            borderRadius: {
                sm: "4px",
                md: "8px",
                lg: "12px",
            },
            fontFamily: {
                sans: ["Inter", "sans-serif"],
            },
        },
    },
    darkMode: false,
};

export default config;
