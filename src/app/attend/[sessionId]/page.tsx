import { PublicShell } from "@/components/shells/PublicShell";
import { AttendanceForm } from "@/components/organisms/AttendanceForm";

export default async function AttendPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t } = await searchParams;

  return (
    <PublicShell showNav={false}>
      <AttendanceForm sessionId={sessionId} token={t} />
    </PublicShell>
  );
}
