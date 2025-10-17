'use client'

import { SpacemanThemeProvider } from '@space-man/react-theme-animation'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <SpacemanThemeProvider
      defaultTheme="system"
      defaultColorTheme="default"
      themes={['light', 'dark', 'system']}
      colorThemes={['default', 'blue', 'green']}
      duration={600}
    >
      {children}
    </SpacemanThemeProvider>
  )
}
