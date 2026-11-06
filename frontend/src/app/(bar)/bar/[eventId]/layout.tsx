import { BarNav } from '@/components/bar/BarNav';

export default async function BarEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <BarNav eventId={eventId} />
      {children}
    </>
  );
}
