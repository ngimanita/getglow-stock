import { Poppins, Playfair_Display } from 'next/font/google';
import localFont from 'next/font/local';

// Latin display/UI face — GETGLOW's "Poppin" (design tokens: fonts.css).
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-core',
  display: 'swap',
});

// Accent face — kickers & taglines, italic only, never all-caps.
export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['italic'],
  variable: '--font-accent',
  display: 'swap',
});

// Real brand Thai face (licensed to the clinic) — replaces the prototype's
// IBM Plex Sans Thai substitute. See design/README.md "Ask the clinic for
// the DB Heavent files before launch" — GETGLOW already has them.
export const dbHeavent = localFont({
  src: [
    { path: '../fonts/db-heavent/DBHeavent-Light.ttf', weight: '300', style: 'normal' },
    { path: '../fonts/db-heavent/DBHeavent-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/db-heavent/DBHeavent-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/db-heavent/DBHeavent-Bold.ttf', weight: '600 700', style: 'normal' },
    { path: '../fonts/db-heavent/DBHeavent-Black.ttf', weight: '800', style: 'normal' },
  ],
  variable: '--font-thai',
  display: 'swap',
});
