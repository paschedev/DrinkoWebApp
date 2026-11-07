import type { Metadata, Viewport } from 'next';
import { ThemeSelect } from '@/components/ui/ThemeSelect';
import './globals.css';

export const metadata: Metadata = {
  title: 'Drinko',
  description: 'Compra en barras de eventos',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f4f8' },
    { media: '(prefers-color-scheme: dark)', color: '#121018' },
  ],
};

// Aplica el tema guardado antes de pintar la página, así no parpadea al cargar.
const themeScript = `try{var t=localStorage.getItem('drinko-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <footer className="site-footer">
          <ThemeSelect />
        </footer>
      </body>
    </html>
  );
}
