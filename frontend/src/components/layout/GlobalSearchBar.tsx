import { useState, useEffect } from 'react';
import { Search, CheckSquare, MessageSquare, FileText, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl, getAuthHeaders } from '../../config/api';

interface SearchItem {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  link: string;
}

export default function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) return;

    const timer = setTimeout(() => {
      fetch(getApiUrl(`/analytics/search?q=${encodeURIComponent(query)}`), {
        headers: getAuthHeaders(),
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setResults(data);
          setIsOpen(true);
        })
        .catch((err) => console.error('Search error:', err));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: SearchItem) => {
    setIsOpen(false);
    setQuery('');
    if (item.type === 'file') {
      window.open(item.link, '_blank');
    } else {
      navigate(item.link);
    }
  };

  return (
    <div className="relative max-w-md w-full">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-nx-muted" />
        <input
          type="text"
          placeholder="Search tasks, messages, files..."
          value={query}
          onChange={handleInputChange}
          className="w-full rounded-lg border border-nx-border bg-nx-card pl-9 pr-4 py-1.5 text-xs text-nx-primary placeholder-nx-muted focus:border-indigo-500 focus:bg-nx-card focus:outline-none transition-all"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div
          className="isolate absolute top-full left-0 right-0 mt-1 rounded-xl border border-gray-200 bg-white p-2 shadow-2xl z-50 max-h-72 overflow-y-auto"
          style={{ backgroundColor: '#ffffff', opacity: 1 }}
        >
          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => handleSelect(item)}
              className="flex w-full items-center justify-between rounded-lg p-2.5 text-left hover:bg-nx-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                  {item.type === 'task' ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : item.type === 'message' ? (
                    <MessageSquare className="h-3.5 w-3.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-nx-primary">{item.title}</p>
                  {item.subtitle && <p className="text-[10px] text-nx-muted">{item.subtitle}</p>}
                </div>
              </div>
              <ArrowRight className="h-3 w-3 text-nx-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
