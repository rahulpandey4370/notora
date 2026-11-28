
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AppProvider } from '@/contexts/app-context';
import ModelCatalogSync from '@/components/providers/model-catalog-sync';
import { resolveEnabledProviders } from '@/lib/ai-providers-server';
import KeyboardInset from '@/components/providers/keyboard-inset';
import UpdatePrompt from '@/components/providers/update-prompt';

// Server actions run under the page that calls them; the ADK chat can make several
// model and tool calls per message (FinWise's chat route allows 300s). 60s fits every Vercel plan.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: 'Notora',
  description: 'Your magical productivity assistant.',
  manifest: "/manifest.json",
  // Home-screen web app on iPhone: full screen, normal status bar.
  appleWebApp: { capable: true, title: 'Notora', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: "#FFDA63",
  width: 'device-width',
  initialScale: 1,
  // Lets env(safe-area-inset-*) report the home indicator / notch, which the sheets and chat pad for.
  viewportFit: 'cover',
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
              <KeyboardInset />
              <UpdatePrompt />
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
