import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Führerscheinkontrolle – Freiwillige Feuerwehr",
  description: "Digitale Führerscheinkontrolle für die Freiwillige Feuerwehr",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var c=(document.cookie.match(/(?:^;|;\\s*)fw_theme=(\\w+)/)||[])[1];
            if(c){localStorage.setItem('theme',c);
            document.documentElement.classList.toggle('dark',c==='dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
