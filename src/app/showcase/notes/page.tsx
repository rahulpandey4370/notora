'use client';

import NotesPage from '@/app/notes/page';
import { ShowcaseProvider } from '@/contexts/showcase-context';

export default function ShowcaseNotesPage() {
  return (
    <ShowcaseProvider>
      <NotesPage showcase={true} />
    </ShowcaseProvider>
  );
}
