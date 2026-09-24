import { Link } from 'react-router-dom';
import { siteConfig } from '../../config/siteConfig';

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden">
      {/* Cinematic landscape background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/image/nexora-footer-forest.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
        {/* Gradient overlay — darker at top for text, transitions to near-black bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom,
              rgba(5,6,7,0.97) 0%,
              rgba(5,6,7,0.88) 35%,
              rgba(5,6,7,0.72) 65%,
              rgba(5,6,7,0.92) 85%,
              rgba(5,6,7,1.00) 100%
            )`,
          }}
        />
      </div>

      {/* Footer content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-12">
        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-[#1B1D1E]">
          {/* Brand column */}
          <div className="md:col-span-6 space-y-4">
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src="/icons/icon-192x192.png"
                alt="Nexora N-X Symbol"
                className="h-7 w-7 rounded-md border border-[#1B1D1E] transition-opacity group-hover:opacity-90"
              />
              <span className="text-base font-semibold tracking-tight text-[#F2F2F0]">Nexora</span>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-[#6F7274]">
              Where teams turn conversations into progress. Connect discussions directly to
              structured tasks, milestones, and project activity in one unified workspace.
            </p>
            <div className="pt-2 text-xs font-mono text-[#6F7274]">
              <span className="text-[#4F5253]">Contact: </span>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="text-[#A3A5A6] hover:text-[#F2F2F0] transition-colors"
              >
                {siteConfig.contact.email}
              </a>
            </div>
          </div>

          {/* Product links */}
          <div className="md:col-span-3 space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#6F7274]">
              Product
            </span>
            <ul className="space-y-2.5 text-xs text-[#A3A5A6]">
              <li><Link to="/#features"     className="transition-colors hover:text-[#F2F2F0]">Features</Link></li>
              <li><Link to="/#how-it-works" className="transition-colors hover:text-[#F2F2F0]">How It Works</Link></li>
              <li><Link to="/#academic"     className="transition-colors hover:text-[#F2F2F0]">Academic Projects</Link></li>
              <li><Link to="/features"      className="transition-colors hover:text-[#F2F2F0]">All Features</Link></li>
            </ul>
          </div>

          {/* Legal & Company links */}
          <div className="md:col-span-3 space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#6F7274]">
              Company &amp; Legal
            </span>
            <ul className="space-y-2.5 text-xs text-[#A3A5A6]">
              <li><Link to="/contact" className="transition-colors hover:text-[#F2F2F0]">Contact</Link></li>
              <li><Link to="/privacy" className="transition-colors hover:text-[#F2F2F0]">Privacy Policy</Link></li>
              <li><Link to="/terms"   className="transition-colors hover:text-[#F2F2F0]">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom meta bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#4F5253] gap-4">
          <p>© {currentYear} {siteConfig.name}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-[#6F7274] transition-colors">Privacy</Link>
            <Link to="/terms"   className="hover:text-[#6F7274] transition-colors">Terms</Link>
            <Link to="/contact" className="hover:text-[#6F7274] transition-colors">Contact</Link>
          </div>
        </div>
      </div>

      {/* Nexora wordmark display — floats over the forest */}
      <div className="relative z-10 select-none pointer-events-none text-center pb-0">
        <span
          className="block font-extrabold tracking-tighter leading-none font-sans"
          style={{
            fontSize: 'clamp(4rem, 14vw, 14rem)',
            color: 'rgba(10,15,12,0.55)',
            mixBlendMode: 'multiply',
          }}
        >
          NEXORA
        </span>
      </div>
    </footer>
  );
}
