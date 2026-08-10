
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AppProvider } from '@/contexts/app-context';
import ModelCatalogSync from '@/components/providers/model-catalog-sync';
import { resolveEnabledProviders } from '@/lib/ai-providers-server';

export const metadata: Metadata = {
  title: 'Notora',
  description: 'Your magical productivity assistant.',
  manifest: "/manifest.json",
  icons: {
    apple: "/notora.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFDA63",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/notora.png"></link>
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AppProvider>
              {/* Resolved server-side from the API keys that actually exist, so the
                  picker reflects real config instead of a build-time NEXT_PUBLIC var. */}
              <ModelCatalogSync providers={resolveEnabledProviders()} />
              {children}
              <Toaster />
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
