'use client';

import LinksPage from '@/app/links/page';
import { ShowcaseProvider } from '@/contexts/showcase-context';

export default function ShowcaseLinksPage() {
  return (
    <ShowcaseProvider>
      <LinksPage showcase={true} />
    </ShowcaseProvider>
  );
}
