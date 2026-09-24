import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';

export default function PublicNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll handler for anchor links
  const handleNavClick = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    if (location.pathname === '/') {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 border-b ${
        isScrolled
          ? 'border-[#1B1D1E] bg-[#050607]/90 backdrop-blur-md'
          : 'border-[#1B1D1E]/60 bg-[#050607]/75 backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded p-1"
          aria-label="Nexora Home"
        >
          <img
            src="/icons/icon-192x192.png"
            alt="Nexora N-X Brand Mark"
            className="h-7 w-7 rounded-md border border-[#1B1D1E] transition-opacity group-hover:opacity-90"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-[#F2F2F0] leading-none">
              Nexora
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#6F7274] mt-0.5">
              Connected Work
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-8 text-xs font-medium text-[#A3A5A6]"
          aria-label="Main Navigation"
        >
          {location.pathname === '/' ? (
            <>
              <button
                type="button"
                onClick={() => handleNavClick('features')}
                className="transition-colors hover:text-[#F2F2F0] focus:outline-none focus-visible:text-white"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('how-it-works')}
                className="transition-colors hover:text-[#F2F2F0] focus:outline-none focus-visible:text-white"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('academic')}
                className="transition-colors hover:text-[#F2F2F0] focus:outline-none focus-visible:text-white"
              >
                Academic
              </button>
            </>
          ) : (
            <>
              <Link to="/#features" className="transition-colors hover:text-[#F2F2F0]">
                Features
              </Link>
              <Link to="/#how-it-works" className="transition-colors hover:text-[#F2F2F0]">
                How It Works
              </Link>
              <Link to="/#academic" className="transition-colors hover:text-[#F2F2F0]">
                Academic
              </Link>
            </>
          )}
        </nav>

        {/* Desktop Action CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-md px-3.5 py-1.5 text-xs font-medium text-[#A3A5A6] transition-colors hover:text-[#F2F2F0] hover:bg-[#101112] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#27292A]"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#F2F2F0] px-3.5 py-1.5 text-xs font-medium text-[#050607] transition-all hover:bg-white active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <span>Get Started</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1B1D1E] bg-[#080909] text-[#A3A5A6] transition-colors hover:text-[#F2F2F0] md:hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMobileMenuOpen && (
        <div className="border-b border-[#1B1D1E] bg-[#080909] px-4 py-4 md:hidden shadow-xl backdrop-blur-lg animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-2 text-xs font-medium text-[#A3A5A6]">
            {location.pathname === '/' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNavClick('features')}
                  className="text-left px-3 py-2 rounded hover:bg-[#101112] hover:text-[#F2F2F0] transition-colors"
                >
                  Features
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('how-it-works')}
                  className="text-left px-3 py-2 rounded hover:bg-[#101112] hover:text-[#F2F2F0] transition-colors"
                >
                  How It Works
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('academic')}
                  className="text-left px-3 py-2 rounded hover:bg-[#101112] hover:text-[#F2F2F0] transition-colors"
                >
                  Academic Projects
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/#features"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 rounded hover:bg-[#101112] hover:text-[#F2F2F0] transition-colors"
                >
                  Features
                </Link>
                <Link
                  to="/#how-it-works"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 rounded hover:bg-[#101112] hover:text-[#F2F2F0] transition-colors"
                >
                  How It Works
                </Link>
                <Link
                  to="/#academic"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 rounded hover:bg-[#101112] hover:text-[#F2F2F0] transition-colors"
                >
                  Academic Projects
                </Link>
              </>
            )}
            <Link
              to="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded hover:bg-[#101112] hover:text-[#F2F2F0] transition-colors"
            >
              Contact
            </Link>

            <div className="pt-3 border-t border-[#1B1D1E] flex flex-col gap-2">
              <Link
                to="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center rounded-md bg-[#F2F2F0] px-4 py-2 text-xs font-medium text-[#050607] transition-colors hover:bg-white"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center rounded-md border border-[#1B1D1E] bg-[#0B0C0D] px-4 py-2 text-xs font-medium text-[#A3A5A6] hover:text-[#F2F2F0] transition-colors"
              >
                Sign In
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
