import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-500",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
    danger: "bg-rose-700 text-white hover:bg-rose-600",
    ghost: "text-slate-300 hover:text-slate-100 hover:bg-slate-800",
  };
  return <button {...rest} className={`${base} ${variants[variant]} ${className}`} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600 " +
        (props.className ?? "")
      }
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-400 mb-1">
      {children}
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-800 bg-slate-900 p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function Spinner({ size = 4 }: { size?: number }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-slate-600 border-t-slate-100 h-${size} w-${size}`}
      style={{ height: `${size * 4}px`, width: `${size * 4}px` }}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <div className="text-sm text-rose-400">{children}</div>;
}
