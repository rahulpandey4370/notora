'use client';

import TasksPage from '@/app/tasks/page';
import { ShowcaseProvider } from '@/contexts/showcase-context';

export default function ShowcaseTasksPage() {
  return (
    <ShowcaseProvider>
      <TasksPage showcase={true} />
    </ShowcaseProvider>
  );
}
