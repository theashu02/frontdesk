"use client"

import { cn } from "@/lib/utils"
import type { ComponentPropsWithoutRef } from "react"

export type InputProps = ComponentPropsWithoutRef<"input">

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}
