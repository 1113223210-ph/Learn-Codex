import { CHAPTER_ORDER, CHAPTER_META } from "@/lib/constants";
import { ChapterPageClient } from "./chapter-page-client";

export function generateStaticParams() {
  return CHAPTER_ORDER.map((id) => ({ id }));
}

export default async function ChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ch = CHAPTER_META[id];

  if (!ch) return <div className="p-8">Chapter not found</div>;

  return <ChapterPageClient id={id} />;
}
