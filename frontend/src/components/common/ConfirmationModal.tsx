import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, X, AlertCircle } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  error?: string | null;
  errorMessage?: string | null;
  onConfirm: () => void | Promise<void>;
  onClose?: () => void;
  onCancel?: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  error = null,
  errorMessage = null,
  onConfirm,
  onClose,
  onCancel,
}: ConfirmationModalProps) {
  const displayDesc = description || message || '';
  const displayError = error || errorMessage || null;
  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  const confirmBtnStyles = isDanger
    ? 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500'
    : variant === 'warning'
    ? 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-500';

  const iconStyles = isDanger
    ? 'bg-red-50 text-red-600 border border-red-200'
    : variant === 'warning'
    ? 'bg-amber-50 text-amber-600 border border-amber-200'
    : 'bg-indigo-50 text-indigo-600 border border-indigo-200';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Translucent Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => !isLoading && handleClose()}
      />

      {/* Solid Opaque Foreground Card */}
      <div
        className="isolate relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl transition-all"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconStyles}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="confirm-modal-title" className="text-base font-bold text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 whitespace-pre-line">
                {displayDesc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Display */}
        {displayError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 transition-colors shadow-2xs"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${confirmBtnStyles}`}
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
