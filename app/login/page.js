'use client'

import { useState, useEffect } from 'react'
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  Button, 
  VStack, 
  FormControl, 
  FormLabel, 
  Input, 
  FormHelperText, 
  InputGroup, 
  InputRightElement, 
  IconButton, 
  Flex, 
  Divider, 
  Link, 
  useToast 
} from '@chakra-ui/react'
import { useRouter, useSearchParams } from 'next/navigation'
import NextLink from 'next/link'
import { useAuth } from '../utils/authContext'

export default function Login() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || '/'
  const toast = useToast()
  const { login, loading: authLoading, isAuthenticated } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.push(returnUrl)
    }
  }, [isAuthenticated, router, returnUrl])
  
  // UI states
  const bgColor = 'dark.900'
  const cardBg = 'dark.800'
  const textColor = 'gray.100'
  const brandGradient = 'linear(to-r, brand.300, brand.500)'

  // Custom toast styles
  const showToast = ({ title, description, status }) => {
    const bgColors = {
      success: 'brand.500',
      error: 'red.500',
      info: 'purple.500',
      warning: 'orange.400'
    };
    
    toast({
      title,
      description,
      status,
      duration: 3000,
      isClosable: true,
      position: 'top',
      variant: 'solid',
      containerStyle: {
        maxWidth: '100%'
      },
      render: ({ onClose }) => (
        <Box 
          color="white" 
          p={4} 
          bg={bgColors[status]} 
          rounded="lg"
          boxShadow="dark-lg"
          display="flex"
          alignItems="flex-start"
          position="relative"
          overflow="hidden"
          _before={{
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '5px',
            height: '100%',
            bg: 'white',
            opacity: 0.3
          }}
        >
          <Box flex="1">
            <Heading as="h3" size="sm" mb={1}>
              {title}
            </Heading>
            <Text fontSize="sm" opacity={0.9}>
              {description}
            </Text>
          </Box>
          <Button 
            size="sm" 
            variant="link" 
            color="white" 
            onClick={onClose}
            opacity={0.7}
            _hover={{ opacity: 1 }}
            ml={3}
            mt={-1}
          >
            ✕
          </Button>
        </Box>
      )
    });
  };
  
  const handleLogin = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setFormError('')
    
    try {
      console.log('Attempting login with:', { email });
      
      // Call login function from auth context
      const result = await login({ email, password })
      console.log('Login result:', result);
      
      if (result.success) {
        // Login successful
        showToast({
          title: 'Login Successful',
          description: 'Welcome back to Wink Trap!',
          status: 'success'
        })
        
        // Redirect to returnUrl or homepage after successful login
        setTimeout(() => {
          router.push(returnUrl)
        }, 1000)
      } else {
        // Login failed
        setFormError(result.message)
        showToast({
          title: 'Login Failed',
          description: result.message,
          status: 'error'
        })
      }
    } catch (error) {
      console.error('Login error:', error)
      setFormError('An unexpected error occurred. Please try again.')
      showToast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        status: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <Box bg={bgColor} minH="100vh" py={10}>
      <Container maxW="md">
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Heading 
              as="h1" 
              size="xl" 
              mb={2}
              bgGradient={brandGradient}
              backgroundClip="text"
            >
              Wink Trap
            </Heading>
            <Text color={textColor} fontSize="lg">
              Sign in to your account
            </Text>
          </Box>
          
          <Box 
            as="form" 
            onSubmit={handleLogin}
            bg={cardBg} 
            p={8} 
            rounded="xl" 
            boxShadow="dark-lg"
            borderWidth="1px"
            borderColor="dark.700"
          >
            <VStack spacing={4}>
              {formError && (
                <Box 
                  w="100%" 
                  p={3} 
                  bg="red.900" 
                  color="white" 
                  rounded="md"
                  fontSize="sm"
                >
                  {formError}
                </Box>
              )}
              
              <FormControl isRequired>
                <FormLabel color="gray.300">Email</FormLabel>
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  rounded="lg"
                  bg="dark.700"
                  borderColor="dark.600"
                  _hover={{
                    borderColor: 'brand.400'
                  }}
                  _focus={{
                    borderColor: 'brand.300',
                    boxShadow: '0 0 0 1px #ffd43b'
                  }}
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel color="gray.300">Password</FormLabel>
                <InputGroup>
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    rounded="lg"
                    bg="dark.700"
                    borderColor="dark.600"
                    _hover={{
                      borderColor: 'brand.400'
                    }}
                    _focus={{
                      borderColor: 'brand.300',
                      boxShadow: '0 0 0 1px #ffd43b'
                    }}
                  />
                  <InputRightElement>
                    <IconButton
                      icon={showPassword ? '👁️' : '👁️‍🗨️'}
                      variant="link"
                      onClick={togglePasswordVisibility}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      color="gray.500"
                      _hover={{
                        color: 'brand.300'
                      }}
                    />
                  </InputRightElement>
                </InputGroup>
                <Flex justify="flex-end" mt={1}>
                  <Link 
                    as={NextLink} 
                    href="/reset-password" 
                    fontSize="sm" 
                    color="gray.400"
                    _hover={{
                      color: 'brand.300',
                      textDecoration: 'none'
                    }}
                  >
                    Forgot password?
                  </Link>
                </Flex>
              </FormControl>
              
              <Button 
                type="submit"
                w="full"
                colorScheme="brand"
                rounded="full"
                mt={4}
                bgGradient={brandGradient}
                _hover={{
                  bg: 'brand.400'
                }}
                isLoading={isLoading || authLoading}
                loadingText="Signing in"
              >
                Sign In
              </Button>
              
              <Divider my={2} borderColor="dark.600" />
              
              <Box textAlign="center">
                <Text color="gray.400" fontSize="sm">
                  Don't have an account?{' '}
                  <Link 
                    as={NextLink} 
                    href="/register" 
                    color="brand.300"
                    _hover={{
                      textDecoration: 'none',
                      color: 'brand.200'
                    }}
                  >
                    Sign up
                  </Link>
                </Text>
              </Box>
            </VStack>
          </Box>
          
          <Box textAlign="center">
            <Text color="gray.500" fontSize="xs">
              © {new Date().getFullYear()} Wink Trap. All rights reserved.
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  )
} 