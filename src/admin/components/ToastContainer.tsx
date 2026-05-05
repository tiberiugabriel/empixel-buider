export type ToastMsg = { id: number; message: string; kind: "success" | "error" };

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  return (
    <div className="epx-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`epx-toast epx-toast--${t.kind}`} onClick={() => onDismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
