import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTopicPreviewById } from "@/lib/topic-queries";
import TopicHubView from "@/components/topic/TopicHubView";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function TopicPreviewPage({ params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const { id } = await params;
  const topic = await getTopicPreviewById(id);
  if (!topic) notFound();
  return <TopicHubView topic={topic} preview />;
}
