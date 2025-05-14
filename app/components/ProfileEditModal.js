'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  Box,
  Flex,
  FormControl,
  FormLabel,
  Input,
  HStack,
  Avatar,
  useToast
} from '@chakra-ui/react'
import { API_ENDPOINTS } from '../utils/api'

export default function ProfileEditModal({ isOpen, onClose, userProfile, setUserProfile, onProfileUpdate }) {
  const [isLoading, setIsLoading] = useState(false)
  const [localProfile, setLocalProfile] = useState({ ...userProfile })
  const [profilePic, setProfilePic] = useState(null)
  const profilePicInputRef = useRef(null)
  const toast = useToast()

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalProfile({ ...userProfile })
      setProfilePic(null)
    }
  }, [isOpen, userProfile])

  // Handle profile picture selection
  const handleProfilePicSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Store the actual File object
      setProfilePic(file)
      
      // Create a preview URL for display
      const imagePreviewUrl = URL.createObjectURL(file)
      
      // Update local preview
      setLocalProfile(prev => ({
        ...prev,
        profilePic: imagePreviewUrl
      }))
      
      // Show success message
      toast({
        title: "Image selected",
        description: "Your profile picture is ready to be updated",
        status: "success",
        duration: 2000,
        isClosable: true
      })
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsLoading(true)
      
      // Create FormData object
      const formData = new FormData()
      formData.append('name', localProfile.name)
      formData.append('email', localProfile.email)
      
      // Add profile pic if selected
      if (profilePic) {
        formData.append('profile_pic', profilePic)
      }
      
      // Log what we're sending
      console.log('Updating profile with:', {
        name: localProfile.name,
        email: localProfile.email,
        hasProfilePic: !!profilePic
      })
      
      // Make direct API request
      const apiUrl = API_ENDPOINTS.users.profile
      console.log('Making request to:', apiUrl)
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          body: formData,
          credentials: 'include',
          // Add explicit headers to prevent redirects
          headers: {
            'Accept': 'application/json'
          }
        })
        
        console.log('Response status:', response.status)
        
        // Parse response as text first
        const text = await response.text()
        console.log('Raw response:', text)
        
        // Try to parse as JSON
        let data
        try {
          data = text ? JSON.parse(text) : {}
          console.log('Parsed response:', data)
        } catch (parseError) {
          console.error('JSON parse error:', parseError)
          throw new Error(`Invalid server response: ${text.substring(0, 100)}...`)
        }
        
        if (data.success) {
          // Update parent component state
          if (data.user) {
            const updatedProfile = {
              name: data.user.name || localProfile.name,
              email: data.user.email || localProfile.email,
              profilePic: data.user.profile_pic || localProfile.profilePic
            }
            
            // Update the profile in the parent component
            setUserProfile(updatedProfile)
            
            // Call the callback if provided
            if (onProfileUpdate) {
              onProfileUpdate(updatedProfile)
            }
          }
          
          // Show success message
          toast({
            title: "Profile updated",
            description: "Your profile has been successfully updated",
            status: "success",
            duration: 3000,
            isClosable: true
          })
          
          // Close the modal
          onClose()
        } else {
          throw new Error(data.message || 'Unknown error updating profile')
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError)
        throw fetchError
      }
    } catch (error) {
      console.error('Profile update error:', error)
      toast({
        title: "Profile update error",
        description: error.message || "An unexpected error occurred. Please try again later.",
        status: "error",
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay 
        bg="blackAlpha.800"
        backdropFilter="blur(10px)"
      />
      <ModalContent rounded="xl" mx={4} borderColor="brand.500" borderWidth="1px" bg="dark.800">
        <ModalHeader color="brand.300">Edit Profile</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={5}>
            {/* Profile Picture */}
            <Box textAlign="center" w="full">
              <Flex direction="column" align="center" justify="center">
                <Avatar
                  size="xl"
                  name={localProfile.name}
                  src={localProfile.profilePic}
                  mb={4}
                  border="3px solid"
                  borderColor="brand.400"
                />
                
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicSelect}
                  ref={profilePicInputRef}
                  style={{ display: 'none' }}
                />
                
                <Button 
                  size="sm"
                  colorScheme="brand" 
                  rounded="full"
                  onClick={() => profilePicInputRef.current.click()}
                >
                  Change Picture
                </Button>
              </Flex>
            </Box>
            
            {/* Name */}
            <FormControl>
              <FormLabel color="gray.300">Name</FormLabel>
              <Input 
                placeholder="Your name" 
                value={localProfile.name}
                onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})}
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
            
            {/* Email */}
            <FormControl>
              <FormLabel color="gray.300">Email</FormLabel>
              <Input 
                placeholder="Your email" 
                value={localProfile.email}
                onChange={(e) => setLocalProfile({...localProfile, email: e.target.value})}
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
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button 
            colorScheme="brand" 
            mr={3} 
            rounded="full"
            bgGradient="linear(to-r, brand.300, brand.500)"
            _hover={{
              bg: 'brand.400'
            }}
            onClick={handleSubmit}
            isLoading={isLoading}
            loadingText="Saving"
          >
            Save Changes
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose} 
            rounded="full"
            color="gray.300"
            borderColor="gray.600"
            _hover={{
              bg: 'dark.700',
              color: 'white',
              borderColor: 'gray.500'
            }}
            isDisabled={isLoading}
          >
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
} 