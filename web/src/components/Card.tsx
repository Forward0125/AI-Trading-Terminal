import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?:  ReactNode;
  action?: ReactNode;
}

export function Card({ title, action, className, children, ...rest }: CardProps) {
  return (
    <section
      className={cn("bg-card border border-line rounded-lg overflow-hidden", className)}
      {...rest}
    >
      {title && (
        <header className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{title}</h2>
          {action ?? null}
        </header>
      )}
      {children}
    </section>
  );
}
