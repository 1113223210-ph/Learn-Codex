import { ChapterSidebar } from "@/components/layout/chapter-sidebar";

export default function ChapterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      {/* 侧边栏：贴左边缘，固定宽度，独立滚动 */}
      <aside className="hidden xl:flex xl:w-64 xl:shrink-0 xl:flex-col border-r border-zinc-800/60">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 pl-5 pr-3">
          <ChapterSidebar />
        </div>
      </aside>

      {/* 主内容区：填满剩余宽度 */}
      <div className="min-w-0 flex-1 px-8 py-8 lg:px-12">
        {children}
      </div>
    </div>
  );
}
