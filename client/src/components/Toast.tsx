import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full font-mono">
      {toasts.map((toast) => {
        const isError = toast.type === "error" || toast.type === "warning";
        const isSuccess = toast.type === "success";

        return (
          <div
            key={toast.id}
            className={`flex items-start justify-between p-3.5 border shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-2 ${
              isError
                ? "bg-[#180a0a] border-rose-800/80 text-rose-200"
                : isSuccess
                ? "bg-[#0a180f] border-emerald-800/80 text-emerald-200"
                : "bg-[#121216] border-white/20 text-neutral-200"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isError ? (
                <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              ) : isSuccess ? (
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Info size={15} className="text-white shrink-0 mt-0.5" />
              )}
              <div>
                <h5 className="font-bold text-[11px] uppercase tracking-wider">{toast.title}</h5>
                {toast.description && (
                  <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">{toast.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-0.5 text-neutral-500 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
