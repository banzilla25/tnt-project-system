import * as React from "react"
import { cn } from "@/utils/cn"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "outline" | "secondary";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80",
    secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
    success: "border-transparent bg-green-100 text-green-800 hover:bg-green-100/80",
    warning: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80",
    destructive: "border-transparent bg-red-100 text-red-800 hover:bg-red-100/80",
    outline: "text-slate-950",
  }
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2", variants[variant], className)} {...props} />
  )
}
