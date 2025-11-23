import { AuthProvider } from '@/contexts/auth-context';
import { AppProvider } from '@/contexts/app-context';

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AppProvider>
        {children}
      </AppProvider>
    </AuthProvider>
  )
}
