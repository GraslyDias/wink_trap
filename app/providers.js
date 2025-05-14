'use client'

import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import { AuthProvider } from './utils/authContext'
import ProtectedRoute from './utils/ProtectedRoute'
import theme from './theme'

export function Providers({ children }) {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <AuthProvider>
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </AuthProvider>
      </ChakraProvider>
    </>
  )
} 