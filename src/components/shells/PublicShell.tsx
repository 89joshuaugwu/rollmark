import Link from "next/link";
import Image from "next/image";

export function PublicShell({
  children,
  showNav = true,
}: {
  children: React.ReactNode;
  showNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-bg text-white">
      {showNav && (
        <header className="flex items-center justify-between px-5 py-4 md:px-10">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="RollMark" width={28} height={28} priority />
            <span className="text-lg font-bold">RollMark</span>
          </Link>
        </header>
      )}
      <main className="flex flex-1 flex-col items-center px-5">{children}</main>
    </div>
  );
}
