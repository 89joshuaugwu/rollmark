import { PublicShell } from "@/components/shells/PublicShell";
import { ShareBoard } from "@/components/organisms/ShareBoard";

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <PublicShell showNav={false}>
      <ShareBoard slug={slug} />
    </PublicShell>
  );
}
