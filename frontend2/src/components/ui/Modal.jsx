import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="p-7 sm:p-9">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold" id="modal-title">
            {title}
          </h2>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
