import '@macropaytd/lib-front-ui-components/styles.css';
import './globals.css';
import { Providers } from './providers';
import SmoothScroll from '@/shared/components/SmoothScroll';
import BarbaWrapper from '@/shared/components/BarbaWrapper';

export const metadata = {
  title: 'MCP Dashboard',
  description:
    'Dashboard generado por MCP pipeline — datos transformados en visualizaciones D3.js',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            var t = localStorage.getItem('mcp-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
          })()
        `,
          }}
        />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Chivo+Mono:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>
          <SmoothScroll>
            <BarbaWrapper>{children}</BarbaWrapper>
          </SmoothScroll>
        </Providers>
      </body>
    </html>
  );
}
