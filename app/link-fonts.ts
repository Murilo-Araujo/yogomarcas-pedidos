import { DM_Sans, Inter, Lora, Montserrat, Nunito, Playfair_Display, Poppins, Roboto } from 'next/font/google';

// Self-hosted by Next.js; load font files only when a selected family is used.
const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-hub-inter' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', preload: false, variable: '--font-hub-poppins' });
const montserrat = Montserrat({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-hub-montserrat' });
const nunito = Nunito({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-hub-nunito' });
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-hub-dm-sans' });
const roboto = Roboto({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-hub-roboto' });
const lora = Lora({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-hub-lora' });
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-hub-playfair' });

export const linkFontVariables = [inter.variable, poppins.variable, montserrat.variable, nunito.variable, dmSans.variable, roboto.variable, lora.variable, playfair.variable].join(' ');
