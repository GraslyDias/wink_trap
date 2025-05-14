'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from './authContext'
import { Box, Spinner, Center, Text } from '@chakra-ui/react'

export default function ProtectedRoute({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, loading, sessionChecked, user } = useAuth()
  const [redirecting, setRedirecting] = useState(false)
  
  // Skip authentication check on these public routes
  const publicRoutes = ['/', '/login', '/register']
  const isPublicRoute = publicRoutes.includes(pathname)
  
  useEffect(() => {
    // Don't do anything until session check is complete
    if (!sessionChecked) return;
    
    // Don't redirect if we're on a public route
    if (isPublicRoute) return;
    
    // Don't redirect if authenticated or still loading
    if (isAuthenticated() || loading) return;
    
    // Avoid multiple redirects
    if (redirecting) return;
    
    // We're not authenticated, not on a public route, and session check is complete
    console.log('User not authenticated, redirecting to login from path:', pathname);
    setRedirecting(true);
    
    // Add a small delay to avoid redirect loops
    const timer = setTimeout(() => {
      router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, loading, pathname, router, isPublicRoute, sessionChecked, redirecting]);
  
  // Show loading spinner while checking authentication
  if (loading && !isPublicRoute) {
    return (
      <Center h="100vh" w="100%">
        <Box textAlign="center">
          <Spinner
            thickness="4px"
            speed="0.65s"
            emptyColor="gray.200"
            color="brand.500"
            size="xl"
            mb={4}
          />
          <Text color="gray.300">Checking authentication...</Text>
        </Box>
      </Center>
    )
  }
  
  // Show loading while redirecting to prevent flash of protected content
  if (redirecting && !isPublicRoute) {
    return (
      <Center h="100vh" w="100%">
        <Box textAlign="center">
          <Spinner
            thickness="4px"
            speed="0.65s"
            emptyColor="gray.200"
            color="brand.500"
            size="xl"
            mb={4}
          />
          <Text color="gray.300">Redirecting to login...</Text>
        </Box>
      </Center>
    )
  }
  
  // If authenticated or on a public route, render children
  return <>{children}</>
} 