/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{js,ts,jsx,tsx}", "./src/index.html"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				bg: {
					base: "var(--bg-base)",
					surface: "var(--bg-surface)",
					elevated: "var(--bg-elevated)",
					hover: "var(--bg-hover)",
				},
				border: {
					DEFAULT: "var(--border)",
					hover: "var(--border-hover)",
				},
				text: {
					primary: "var(--text-primary)",
					secondary: "var(--text-secondary)",
					muted: "var(--text-muted)",
				},
				accent: {
					primary: "var(--accent-primary)",
					success: "var(--accent-success)",
					warning: "var(--accent-warning)",
					error: "var(--accent-error)",
				},
				brand: "#0092b8",
				"bg-1": "var(--build-chat-colors-bg-1)",
				"bg-2": "var(--build-chat-colors-bg-2)",
				"bg-3": "var(--build-chat-colors-bg-3)",
				"bg-4": "var(--build-chat-colors-bg-4)",
				"border-primary": "var(--build-chat-colors-border-primary)",
				"border-secondary": "var(--build-chat-colors-border-secondary)",
				"border-tertiary": "var(--build-chat-colors-border-tertiary)",
				"text-primary": "var(--build-chat-colors-text-primary)",
				"text-secondary": "var(--build-chat-colors-text-secondary)",
				"text-tertiary": "var(--build-chat-colors-text-tertiary)",
			},
			fontFamily: {
				sans: [
					"Inter",
					"ui-sans-serif",
					"system-ui",
					"sans-serif",
					"Apple Color Emoji",
					"Segoe UI Emoji",
					"Segoe UI Symbol",
					"Noto Color Emoji",
				],
				mono: [
					"SF Mono",
					"Monaco",
					"Inconsolata",
					"Fira Mono",
					"Droid Sans Mono",
					"Source Code Pro",
					"monospace",
				],
			},
			boxShadow: {
				dialog: "0px 18px 60px 0px rgba(6, 6, 5, 0.1), 3px 3px 13px 0px rgba(0, 0, 0, 0.04), -3px 3px 13px 0px rgba(0, 0, 0, 0.04), 24px 24px 24px 0px rgba(0, 0, 0, 0.03), -24px 24px 24px 0px rgba(0, 0, 0, 0.03), 53px 53px 32px 0px rgba(0, 0, 0, 0.02), 0px 0px 0px 1px rgba(217, 217, 217, 0.2)",
				elevation:
					"6px 6px 13px 0px rgba(0, 0, 0, 0.04), 24px 24px 24px 0px rgba(0, 0, 0, 0.03), 53px 53px 32px 0px rgba(0, 0, 0, 0.02), 0px 0px 0px 1px rgba(217, 217, 217, 0.2)",
			},
			animation: {
				"fade-in": "fadeIn 0.3s ease-out",
				"slide-up": "slideUp 0.3s ease-out",
				"spin-slow": "spin 2s linear infinite",
			},
			keyframes: {
				fadeIn: {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
				slideUp: {
					"0%": { opacity: "0", transform: "translateY(10px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
			},
		},
	},
	plugins: [],
};
