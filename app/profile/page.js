'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  Button, 
  VStack, 
  HStack, 
  Flex, 
  Spacer,
  Avatar,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  useToast,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Link,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Switch,
  IconButton
} from '@chakra-ui/react'

export default function ProfilePage() {
  const router = useRouter()
  const toast = useToast()
  const fileInputRef = useRef(null)
  
  // State for user profile with demo data
  const [userProfile, setUserProfile] = useState({
    name: 'Demo User',
    email: 'user@example.com',
    profilePic: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=500&q=60',
    notifications: true,
    darkMode: true,
    bio: 'This is a demo profile for the Wink Trap application.',
    lastActive: '2 hours ago',
    joinDate: 'January 2023',
    totalWalls: 5,
    favoriteWall: 'Demo Wall 1'
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  
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

  // Welcome effect - show welcome toast on page load
  useEffect(() => {
    showToast({
      title: 'Demo Mode',
      description: 'You are viewing the demo profile',
      status: 'info'
    });
  }, []);

  // Handler for profile picture
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      
      // Immediately update profile picture
      setUserProfile(prev => ({
        ...prev,
        profilePic: imageUrl
      }));
      
      showToast({
        title: "Profile picture updated",
        description: "Your profile picture has been successfully changed",
        status: "success",
      });
    }
  }
  
  // Handler for saving profile changes
  const handleSaveProfile = () => {
    setIsLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      // Here you would update profile in your database
      
      showToast({
        title: "Profile updated",
        description: "Your profile has been successfully updated",
        status: "success",
      });
      
      setIsLoading(false);
    }, 1000);
  }
  
  // Handler for going back to home
  const handleBackToHome = () => {
    router.push('/');
  }
  
  return (
    <Box bg={bgColor} minH="100vh" py={8}>
      <Container maxW="container.md">
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Flex align="center" mb={4}>
            <Button 
              variant="ghost" 
              color="gray.400" 
              onClick={handleBackToHome}
              leftIcon={<Box as="span" fontSize="1.2em">←</Box>}
              _hover={{
                color: 'white',
                bg: 'dark.700'
              }}
              size="sm"
            >
              Back to Home
            </Button>
            <Spacer />
            <Heading 
              as="h1" 
              size="lg" 
              bgGradient={brandGradient}
              backgroundClip="text"
            >
              User Profile
            </Heading>
            <Spacer />
            <Box w="80px" /> {/* Balance the layout */}
          </Flex>
          
          {/* Profile Content */}
          <Card bg={cardBg} rounded="xl" overflow="hidden" boxShadow="dark-lg" borderColor="dark.700" borderWidth="1px">
            <CardHeader bg="dark.700" py={6}>
              <Flex direction={{ base: "column", md: "row" }} align="center" gap={6}>
                <Box position="relative">
                  <Avatar 
                    size="xl" 
                    name={userProfile.name} 
                    src={userProfile.profilePic}
                    border="4px solid"
                    borderColor="brand.400"
                  />
                  <IconButton
                    icon="📷"
                    aria-label="Change profile picture"
                    size="sm"
                    isRound
                    position="absolute"
                    bottom={0}
                    right={0}
                    colorScheme="brand"
                    onClick={() => fileInputRef.current.click()}
                  />
                  <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                  />
                </Box>
                
                <Box flex="1" textAlign={{ base: "center", md: "left" }}>
                  <Heading as="h2" size="lg" color="white" mb={1}>
                    {userProfile.name}
                  </Heading>
                  <Text color="gray.400">
                    {userProfile.email}
                  </Text>
                  <Text color="brand.300" mt={1} fontSize="sm">
                    Active {userProfile.lastActive} · Joined {userProfile.joinDate}
                  </Text>
                </Box>
              </Flex>
            </CardHeader>
            
            <CardBody p={0}>
              <Tabs colorScheme="brand" variant="enclosed">
                <TabList bg="dark.700" px={4}>
                  <Tab 
                    color="gray.400" 
                    _selected={{ 
                      color: 'brand.300', 
                      borderColor: 'brand.400',
                      bg: cardBg
                    }}
                  >
                    Personal Info
                  </Tab>
                  <Tab 
                    color="gray.400" 
                    _selected={{ 
                      color: 'brand.300', 
                      borderColor: 'brand.400',
                      bg: cardBg
                    }}
                  >
                    Settings
                  </Tab>
                  <Tab 
                    color="gray.400" 
                    _selected={{ 
                      color: 'brand.300', 
                      borderColor: 'brand.400',
                      bg: cardBg
                    }}
                  >
                    Stats
                  </Tab>
                </TabList>
                
                <TabPanels>
                  {/* Personal Info Panel */}
                  <TabPanel p={6}>
                    <VStack spacing={5} align="stretch">
                      <FormControl>
                        <FormLabel color="gray.300">Full Name</FormLabel>
                        <Input 
                          placeholder="Your name" 
                          value={userProfile.name}
                          onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
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
                      
                      <FormControl>
                        <FormLabel color="gray.300">Email</FormLabel>
                        <Input 
                          type="email"
                          placeholder="Your email" 
                          value={userProfile.email}
                          onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
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
                        <FormHelperText color="gray.500">
                          Your email address won't be shared publicly
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel color="gray.300">Bio</FormLabel>
                        <Input 
                          placeholder="Tell us about yourself" 
                          value={userProfile.bio}
                          onChange={(e) => setUserProfile({...userProfile, bio: e.target.value})}
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
                      
                      <FormControl>
                        <FormLabel color="gray.300">Password</FormLabel>
                        <Button 
                          colorScheme="purple" 
                          variant="outline" 
                          rounded="lg"
                          size="md"
                          width="full"
                        >
                          Change Password
                        </Button>
                      </FormControl>
                      
                      <Divider borderColor="dark.600" my={2} />
                      
                      <Flex justify="flex-end">
                        <Button 
                          colorScheme="brand" 
                          rounded="full"
                          bgGradient={brandGradient}
                          _hover={{
                            bg: 'brand.400'
                          }}
                          isLoading={isLoading}
                          loadingText="Saving"
                          onClick={handleSaveProfile}
                        >
                          Save Changes
                        </Button>
                      </Flex>
                    </VStack>
                  </TabPanel>
                  
                  {/* Settings Panel */}
                  <TabPanel p={6}>
                    <VStack spacing={5} align="stretch">
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <FormLabel htmlFor="notifications" color="gray.300" mb="0">
                          Enable Notifications
                        </FormLabel>
                        <Switch 
                          id="notifications" 
                          isChecked={userProfile.notifications}
                          onChange={(e) => setUserProfile({...userProfile, notifications: e.target.checked})}
                          colorScheme="brand"
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <FormLabel htmlFor="darkMode" color="gray.300" mb="0">
                          Dark Mode
                        </FormLabel>
                        <Switch 
                          id="darkMode" 
                          isChecked={userProfile.darkMode}
                          onChange={(e) => setUserProfile({...userProfile, darkMode: e.target.checked})}
                          colorScheme="brand"
                        />
                      </FormControl>
                      
                      <Divider borderColor="dark.600" my={2} />
                      
                      <Flex justify="flex-end">
                        <Button 
                          colorScheme="brand" 
                          rounded="full"
                          bgGradient={brandGradient}
                          _hover={{
                            bg: 'brand.400'
                          }}
                          isLoading={isLoading}
                          loadingText="Saving"
                          onClick={handleSaveProfile}
                        >
                          Save Settings
                        </Button>
                      </Flex>
                    </VStack>
                  </TabPanel>
                  
                  {/* Stats Panel */}
                  <TabPanel p={6}>
                    <VStack spacing={5} align="stretch">
                      <Box p={4} bg="dark.700" rounded="lg" borderLeft="4px solid" borderColor="brand.400">
                        <Text color="gray.300" mb={1}>Total Walls</Text>
                        <Heading size="md" color="white">{userProfile.totalWalls}</Heading>
                      </Box>
                      
                      <Box p={4} bg="dark.700" rounded="lg" borderLeft="4px solid" borderColor="purple.400">
                        <Text color="gray.300" mb={1}>Favorite Wall</Text>
                        <Heading size="md" color="white">{userProfile.favoriteWall}</Heading>
                      </Box>
                      
                      <Box p={4} bg="dark.700" rounded="lg" borderLeft="4px solid" borderColor="blue.400">
                        <Text color="gray.300" mb={1}>Messages Sent</Text>
                        <Heading size="md" color="white">42</Heading>
                      </Box>
                      
                      <Box p={4} bg="dark.700" rounded="lg" borderLeft="4px solid" borderColor="green.400">
                        <Text color="gray.300" mb={1}>Active Days</Text>
                        <Heading size="md" color="white">16</Heading>
                      </Box>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>
          
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