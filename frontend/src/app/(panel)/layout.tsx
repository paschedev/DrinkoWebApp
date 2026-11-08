import { PanelHeader } from '@/components/panel/PanelHeader';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PanelHeader />
      {children}
    </>
  );
}
