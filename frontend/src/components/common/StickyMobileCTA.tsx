import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface StickyMobileCTAProps {
  label?: string;
  subLabel?: string;
  to?: string;
}

export default function StickyMobileCTA({
  label = 'Get Started',
  subLabel = 'Turn conversations into progress',
  to = '/register',
}: StickyMobileCTAProps) {
  return (
    <aside
      aria-label="Mobile Call to Action"
      className="fixed bottom-0 left-0 right-0 z-40 block md:hidden border-t border-[#1B1D1E] bg-[#050607]/95 p-3 backdrop-blur-lg"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col pl-1">
          <span className="text-xs font-semibold text-[#F2F2F0] leading-tight">Ready to connect your work?</span>
          <span className="text-[10px] text-[#6F7274]">{subLabel}</span>
        </div>

        <Link
          to={to}
          className="flex items-center gap-1.5 rounded-md bg-[#F2F2F0] px-3.5 py-1.5 text-xs font-medium text-[#050607] transition-all active:scale-95 hover:bg-white"
        >
          <span>{label}</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </aside>
  );
}
