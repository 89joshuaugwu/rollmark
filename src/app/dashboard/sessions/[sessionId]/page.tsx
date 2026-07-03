import { LiveSessionBoard } from "@/components/organisms/LiveSessionBoard";

export default async function LiveSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <LiveSessionBoard sessionId={sessionId} />;
}
