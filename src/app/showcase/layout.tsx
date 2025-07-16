
import { AuthProvider } from '@/contexts/auth-context';
import { AppProvider } from '@/contexts/app-context';
import { ShowcaseProvider } from '@/contexts/showcase-context';

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AppProvider>
        <ShowcaseProvider>
          {children}
        </ShowcaseProvider>
      </AppProvider>
    </AuthProvider>
  )
}
