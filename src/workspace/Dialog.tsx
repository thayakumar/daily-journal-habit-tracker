import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  function isOutside(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target !== e.currentTarget) return false;
    const r = e.currentTarget.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={onClose}
      onMouseDown={(e) => {
        pointerStartedOutside.current = isOutside(e);
      }}
      onClick={(e) => {
        if (pointerStartedOutside.current && isOutside(e)) {
          onClose();
        }
        pointerStartedOutside.current = false;
      }}
      className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] ${wide ? "max-w-5xl" : "max-w-xl"} overflow-y-auto rounded-[20px] border border-[#E7DDD0] bg-white p-5 shadow-[0_24px_60px_-16px_rgba(36,32,29,0.22),0_4px_12px_rgba(36,32,29,0.08)] backdrop:bg-[#24201D]/35 backdrop:backdrop-blur-xs sm:p-7`}
    >
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#EFE8DC] pb-4">
        <h2
          id={id}
          className="font-display text-xl font-semibold text-[#24201D]"
        >
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#5C5248] transition-colors hover:bg-[#F3EDE3] hover:text-[#24201D]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
