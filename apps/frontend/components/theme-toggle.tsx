'use client'

import { Button } from '@/components/ui/button'
import { useSpacemanTheme } from '@space-man/react-theme-animation'
import { Moon, Sun } from 'lucide-react'
import { useRef } from 'react'

export function ThemeToggle() {
  const { theme, switchThemeFromElement } = useSpacemanTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleToggle = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    if (buttonRef.current) {
      await switchThemeFromElement(newTheme, buttonRef.current)
    }
  }

  return (
    <Button
      ref={buttonRef}
      onClick={handleToggle}
      className="theme-toggle"
      aria-label="Toggle theme"
      variant="outline"
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </Button>
  )
}
