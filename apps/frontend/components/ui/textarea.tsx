"use client"

import { cn } from "@/lib/utils"
import type { ComponentPropsWithoutRef } from "react"

export type TextareaProps = ComponentPropsWithoutRef<"textarea">

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}
