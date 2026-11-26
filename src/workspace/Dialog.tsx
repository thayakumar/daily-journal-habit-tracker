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
      className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] ${wide ? "max-w-5xl" : "max-w-xl"} overflow-y-auto rounded-2xl border border-[#EAE2D6] bg-white p-6 shadow-xl backdrop:bg-[#24201D]/35 sm:p-8`}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 id={id} className="font-display text-xl font-semibold text-[#24201D]">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#62584E] transition hover:bg-[#F3EDE3] hover:text-[#24201D]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
