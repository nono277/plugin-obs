/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				spotify: {
					green: '#1DB954',
					black: '#121212',
					dark: '#181818',
					darker: '#0D0D0D',
					gray: '#282828',
					light: '#B3B3B3',
					white: '#FFFFFF'
				},
				neon: {
					purple: '#9B59B6',
					pink: '#E91E8C',
					blue: '#00D4FF',
					glow: '#BF5FFF'
				}
			},
			animation: {
				'spin-slow': 'spin 8s linear infinite',
				'spin-medium': 'spin 5s linear infinite',
				'spin-fast': 'spin 3s linear infinite',
				'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
				'marquee': 'marquee 15s linear infinite',
				'fade-in': 'fadeIn 0.5s ease-out',
				'slide-up': 'slideUp 0.4s ease-out',
				'bar': 'barPulse 0.5s ease-in-out infinite alternate'
			},
			keyframes: {
				pulseGlow: {
					'0%, 100%': { boxShadow: '0 0 20px rgba(29,185,84,0.4)' },
					'50%': { boxShadow: '0 0 40px rgba(29,185,84,0.8)' }
				},
				marquee: {
					'0%': { transform: 'translateX(0%)' },
					'100%': { transform: 'translateX(-50%)' }
				},
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				slideUp: {
					'0%': { transform: 'translateY(20px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				barPulse: {
					'0%': { transform: 'scaleY(0.3)' },
					'100%': { transform: 'scaleY(1)' }
				}
			},
			backdropBlur: {
				xs: '2px'
			}
		}
	},
	plugins: []
};
