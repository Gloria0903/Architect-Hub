import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, required, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-[11.5px] font-medium text-muted">
        {label}
        {required && <span className="text-brick ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-brick">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full border border-line rounded-md px-3 py-2 text-[12.5px] text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-blueprint/40 placeholder:text-muted/60";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, "cursor-pointer", className)} {...props} />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(inputCls, "resize-none leading-relaxed", className)}
      {...props}
    />
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  const base = "inline-flex items-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-[12px]", md: "px-4 py-2 text-[12.5px]" };
  const variants = {
    primary: "bg-ink text-white hover:bg-ink/80",
    secondary: "bg-surface border border-line text-ink hover:bg-vellum",
    danger: "bg-brick text-white hover:bg-brick/80",
    ghost: "text-muted hover:text-ink hover:bg-vellum",
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-brick-bg border border-brick/20 text-brick text-[12px] px-3 py-2.5">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-moss-bg border border-moss/20 text-moss text-[12px] px-3 py-2.5">
      {message}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-5 w-5 rounded-full border-2 border-line border-t-blueprint animate-spin" />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && <div className="text-muted/40 mb-3">{icon}</div>}
      <div className="font-medium text-ink text-[13.5px]">{title}</div>
      {body && <p className="text-muted text-[12px] mt-1 max-w-xs leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const sizes = { sm: "w-6 h-6 text-[10px]", md: "w-8 h-8 text-[11px]", lg: "w-10 h-10 text-[13px]" };
  return (
    <div
      className={cn(
        "rounded-full bg-blueprint-bg text-blueprint font-semibold flex items-center justify-center shrink-0",
        sizes[size],
      )}
    >
      {initials}
    </div>
  );
}
