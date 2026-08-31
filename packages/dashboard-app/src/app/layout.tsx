import '@macropaytd/lib-front-ui-components/styles.css';
import './globals.css';
import { Providers } from './providers';
import SmoothScroll from '@/shared/components/SmoothScroll';
import BarbaWrapper from '@/shared/components/BarbaWrapper';

export const metadata = {
  title: 'Space Insight AI',
  description:
    'Space Insight AI — dashboards generados por MCP pipeline con AWS Bedrock',
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Orbitron:wght@300;400;500&family=Exo+2:ital,wght@0,100..900;1,100..900&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap"
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
