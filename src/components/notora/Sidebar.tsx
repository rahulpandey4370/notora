'use client';

import SidebarContent from "./SidebarContent";

export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col items-center w-16 bg-background border-r py-4 space-y-4">
      <SidebarContent />
    </aside>
  );
}
