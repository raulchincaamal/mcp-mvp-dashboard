import "@macropaytd/lib-front-ui-components/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import SmoothScroll from "@/shared/components/SmoothScroll";

export const metadata = {
  title: "MCP Dashboard",
  description: "Dashboard generado por MCP pipeline — datos transformados en configs Chart.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('mcp-theme');
            if (t) document.documentElement.setAttribute('data-theme', t);
          })()
        `}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers><SmoothScroll>{children}</SmoothScroll></Providers>
      </body>
    </html>
  );
}
