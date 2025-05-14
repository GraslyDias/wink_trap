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
  useToast,
  HStack,
  Checkbox
} from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { registerUser } from '../utils/api'
import { useAuth } from '../utils/authContext'

export default function Register() {
  const router = useRouter()
  const toast = useToast()
  const { login, isAuthenticated } = useAuth()
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/')
    }
  }, [isAuthenticated, router])
  
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

  const validateForm = () => {
    const newErrors = {}
    
    if (!name) newErrors.name = 'Name is required'
    if (!email) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid'
    
    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password'
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    
    if (!agreeTerms) newErrors.agreeTerms = 'You must agree to the terms'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleRegister = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!validateForm()) {
      setFormError('Please correct the errors in the form.')
      return
    }
    
    setIsLoading(true)
    setFormError('')
    
    try {
      // Call API to register user
      const registerData = {
        name,
        email,
        password
      }
      
      const response = await registerUser(registerData)
      
      if (response.success) {
        showToast({
          title: 'Account Created',
          description: 'Your account has been created successfully!',
          status: 'success'
        })
        
        // Automatically log in the user after successful registration
        const loginResult = await login({ email, password })
        
        if (loginResult.success) {
          // Redirect to home page after successful login
          router.push('/')
        } else {
          // If login fails, redirect to login page
          setTimeout(() => {
            router.push('/login')
          }, 1500)
        }
      } else {
        // Handle registration error
        setFormError(response.data?.message || 'Registration failed. Please try again.')
        showToast({
          title: 'Registration Failed',
          description: response.data?.message || 'An error occurred during registration.',
          status: 'error'
        })
      }
    } catch (error) {
      console.error('Registration error:', error)
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
              Create your account
            </Text>
          </Box>
          
          <Box 
            as="form" 
            onSubmit={handleRegister}
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
              
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel color="gray.300">Full Name</FormLabel>
                <Input 
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                {errors.name && (
                  <FormHelperText color="red.300">{errors.name}</FormHelperText>
                )}
              </FormControl>
              
              <FormControl isRequired isInvalid={!!errors.email}>
                <FormLabel color="gray.300">Email</FormLabel>
                <Input 
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {errors.email && (
                  <FormHelperText color="red.300">{errors.email}</FormHelperText>
                )}
              </FormControl>
              
              <FormControl isRequired isInvalid={!!errors.password}>
                <FormLabel color="gray.300">Password</FormLabel>
                <InputGroup>
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                {errors.password ? (
                  <FormHelperText color="red.300">{errors.password}</FormHelperText>
                ) : (
                  <FormHelperText color="gray.500">
                    Use at least 8 characters with letters and numbers
                  </FormHelperText>
                )}
              </FormControl>
              
              <FormControl isRequired isInvalid={!!errors.confirmPassword}>
                <FormLabel color="gray.300">Confirm Password</FormLabel>
                <Input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                {errors.confirmPassword && (
                  <FormHelperText color="red.300">{errors.confirmPassword}</FormHelperText>
                )}
              </FormControl>
              
              <FormControl isRequired isInvalid={!!errors.agreeTerms}>
                <Checkbox 
                  colorScheme="brand" 
                  isChecked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  mt={2}
                >
                  <Text fontSize="sm" color="gray.400">
                    I agree to the <Link color="brand.300" href="#">Terms of Service</Link> and <Link color="brand.300" href="#">Privacy Policy</Link>
                  </Text>
                </Checkbox>
                {errors.agreeTerms && (
                  <FormHelperText color="red.300">{errors.agreeTerms}</FormHelperText>
                )}
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
                isLoading={isLoading}
                loadingText="Creating Account"
              >
                Create Account
              </Button>
              
              <Divider my={2} borderColor="dark.600" />
              
              <Box textAlign="center">
                <Text color="gray.400" fontSize="sm">
                  Already have an account?{' '}
                  <Link 
                    as={NextLink} 
                    href="/login" 
                    color="brand.300"
                    _hover={{
                      textDecoration: 'none',
                      color: 'brand.200'
                    }}
                  >
                    Sign in
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