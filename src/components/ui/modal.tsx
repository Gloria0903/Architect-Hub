"use client";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = "max-w-lg" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-solid/40 backdrop-blur-sm">
      <div className={`bg-surface rounded-card w-full ${maxWidth} max-h-[90vh] overflow-y-auto shadow-xl`}>
        <div className="flex items-start justify-between p-5 border-b border-line">
          <div>
            <div className="font-display font-semibold text-[15px] text-ink">{title}</div>
            {subtitle && <div className="text-muted text-[12px] mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
