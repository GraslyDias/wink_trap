'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  Button, 
  VStack, 
  HStack, 
  Flex, 
  Grid, 
  GridItem, 
  Image, 
  Badge, 
  Card, 
  CardBody, 
  CardFooter,
  Avatar,
  Input,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  InputGroup,
  InputRightElement,
  Icon,
  Spacer,
  FormHelperText,
  useToast,
  useColorModeValue,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Textarea
} from '@chakra-ui/react'
import { getWalls, createWall, joinWall, getUserProfile, updateUserProfile, updateWall, API_ENDPOINTS } from './utils/api'
import { useAuth } from './utils/authContext'
import ProfileEditModal from './components/ProfileEditModal'

export default function Home() {
  const router = useRouter()
  const toast = useToast()
  const fileInputRef = useRef(null)
  const { user, logout: authLogout, isAuthenticated, loading } = useAuth()
  
  // Add state for user profile
  const [userProfile, setUserProfile] = useState(null)
  
  // Add state to track if welcome toast has been shown
  const [welcomeToastShown, setWelcomeToastShown] = useState(false)
  
  // Modal state for profile editing
  const { 
    isOpen: isProfileOpen, 
    onOpen: onProfileOpen, 
    onClose: onProfileClose 
  } = useDisclosure()
  
  // Load walls data on mount
  useEffect(() => {
    console.log('Home page mounted');
    
    // Verify session and load walls
    const initializeApp = async () => {
      try {
        // Check if authentication is still loading
        if (loading) {
          console.log('Authentication status is still loading, waiting...');
          return; // Don't do anything yet, wait for auth to complete
        }
        
        // After loading is complete, check if user is authenticated
        const authenticated = isAuthenticated();
        console.log('User authenticated:', authenticated);
        
        if (!authenticated) {
          console.log('User not authenticated, redirecting to login');
          router.push('/login');
          return;
        }
        
        // Set initial user profile data from auth context
        if (user) {
          console.log('Setting user profile from auth context:', user);
          setUserProfile({
            name: user.name || 'User',
            email: user.email || '',
            profilePic: user.profile_pic || 'https://bit.ly/broken-link'
          });
        } else {
          console.log('No user data available from auth context');
          setUserProfile({
            name: 'User',
            email: '',
            profilePic: 'https://bit.ly/broken-link'
          });
        }
        
        // Load walls from API
        try {
        await loadWalls();
        } catch (wallsError) {
          console.error('Error loading walls:', wallsError);
          showToast({
            title: 'Error Loading Walls',
            description: 'Could not load your walls. We\'ll retry in a moment.',
            status: 'error'
          });
          
          // Add a retry for walls loading after a short delay
          setTimeout(() => {
            loadWalls().catch(err => {
              console.error('Retry loading walls failed:', err);
            });
          }, 2000);
        }
        
        // Get user profile from API to ensure we have the latest data
        try {
        const userResponse = await getUserProfile();
        console.log('User profile response:', userResponse);
        
        if (userResponse.success && userResponse.data) {
            setUserProfile(prevProfile => ({
              name: userResponse.data.name || prevProfile.name || 'User',
              email: userResponse.data.email || prevProfile.email || '',
              profilePic: userResponse.data.profile_pic || prevProfile.profilePic || 'https://bit.ly/broken-link'
            }));
          }
        } catch (profileError) {
          console.error('Error loading user profile:', profileError);
          // Continue with existing profile data, don't show error to user
        }
        
        // Show welcome toast only if we have a valid user profile and it hasn't been shown yet
        if (userProfile?.name && !welcomeToastShown) {
        showToast({
          title: 'Welcome',
          description: `Welcome to Wink Trap, ${userProfile.name}`,
          status: 'success'
        });
          
          // Mark welcome toast as shown
          setWelcomeToastShown(true);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        showToast({
          title: 'Connection Error',
          description: 'Unable to connect to the server. Please try again later.',
          status: 'error'
        });
        
        // Set minimal user profile if none exists
        if (!userProfile) {
          setUserProfile({
            name: user?.name || 'User',
            email: user?.email || '',
            profilePic: user?.profile_pic || 'https://bit.ly/broken-link'
          });
        }
      }
    };
    
    initializeApp();
    
    // Re-run this effect if authentication status changes, but not when welcomeToastShown changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router, user, loading]);

  // Modal states for create and join walls
  const { 
    isOpen: isCreateOpen, 
    onOpen: onCreateOpen, 
    onClose: onCreateClose 
  } = useDisclosure()
  
  const { 
    isOpen: isJoinOpen, 
    onOpen: onJoinOpen, 
    onClose: onJoinClose 
  } = useDisclosure()
  
  // Form states
  const [wallName, setWallName] = useState('')
  const [wallPassword, setWallPassword] = useState('')
  const [wallId, setWallId] = useState('')
  const [wallDescription, setWallDescription] = useState('')
  const [joinWallId, setJoinWallId] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedImageName, setSelectedImageName] = useState('No file chosen')
  
  // Add state for image preview
  const [imagePreview, setImagePreview] = useState(null)
  
  // Add state for loading
  const [isLoading, setIsLoading] = useState(false)
  
  // UI states
  const bgColor = 'dark.900'
  const cardBg = 'dark.800'
  const textColor = 'gray.100'
  const brandGradient = 'linear(to-r, brand.300, brand.500)'

  // Initialize walls state with empty array
  const [walls, setWalls] = useState([])

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

  // Load walls function - full API implementation
  const loadWalls = async () => {
    try {
      setIsLoading(true);
      
      // Verify authentication status before proceeding
      const authenticated = isAuthenticated();
      console.log('Authentication status before loading walls:', authenticated);
      
      // Skip API call if not authenticated
      if (!authenticated) {
        console.log('Not authenticated, skipping walls loading');
        setWalls([]);
        return;
      }
      
      // Call the API to get walls
      console.log('Calling getWalls API...');
      const response = await getWalls();
      console.log('Walls API response:', response);
      
      if (response.success && response.data && response.data.walls) {
        if (response.data.walls.length > 0) {
        // Transform API data to match our wall structure
          const apiWalls = response.data.walls.map(wall => {
            console.log('Processing wall data:', wall);
            return {
              id: wall.id,
              name: wall.name,
              // Use the 'image' field from API response which contains the correct image URL
              image: wall.image || wall.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
              // Use the 'members' field from API response for member count
              members: parseInt(wall.members || wall.member_count || 0),
              isJoined: true, // Assuming all returned walls are joined
              createdBy: wall.createdBy || null  // Use createdBy directly from the API response
            };
          });
        
        setWalls(apiWalls);
          console.log('Walls loaded successfully:', apiWalls);
      } else {
          // Empty walls array returned from API
          console.log('No walls found from API, setting empty walls array');
          setWalls([]);
          
          // Show message to create first wall
          showToast({
            title: 'No Walls Found',
            description: 'Create your first wall to get started!',
            status: 'info'
          });
        }
      } else {
        // Handle API error or invalid response format
        console.warn('Invalid response format from API:', response);
        
        // If auth error, we may need to log in again
        if (response.status === 401) {
          console.log('Authentication error (401) on walls API call');
          showToast({
            title: 'Authentication Error',
            description: 'Your session has expired. Please log in again.',
            status: 'error'
          });
          
          // Wait a moment before redirecting
          setTimeout(() => {
            router.push('/login');
          }, 2000);
          return;
        }
        
        // Network errors (status 0) should show a connection error
        if (response.status === 0) {
          showToast({
            title: 'Connection Error',
            description: 'Unable to connect to the server. Please check your internet connection.',
            status: 'error'
          });
          // Keep existing walls if we have them
          return;
        }
        
        // Other errors - keep existing walls if we have them, otherwise show empty state
        if (walls.length === 0) {
          // Show empty state and error
          setWalls([]);
          
          showToast({
            title: 'Error Loading Walls',
            description: response.data?.message || 'Could not load your walls. Please try again.',
            status: 'error'
          });
        } else {
          // Show a toast with the error message
          showToast({
            title: 'Error Loading Walls',
            description: response.data?.message || 'Could not load your walls. Please try again.',
            status: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Error loading walls:', error);
      
      // Keep existing walls on error, don't clear them
      if (walls.length === 0) {
      setWalls([]);
      }
      
      // Show error toast
      showToast({
        title: 'Error',
        description: 'Failed to load walls. Please try again later.',
        status: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for joining a wall with ID and password
  const handleJoinWall = async () => {
    if (!joinWallId || !joinPassword) {
      showToast({
        title: "Missing information",
        description: "Wall ID and password are required to join a wall",
        status: "error",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Prepare join data for API
      const joinData = {
        wallId: joinWallId,
        password: joinPassword
      };
      
      // Call the API to join the wall
      const response = await joinWall(joinData);
      
      if (response.success) {
        // Reload walls to get the updated list
        await loadWalls();
      
      showToast({
        title: "Wall joined!",
        description: `You've successfully joined the wall`,
        status: "success",
      });
      
      // Reset form and close modal
      setJoinWallId('');
      setJoinPassword('');
      setPasswordError(false);
      onJoinClose();
        
        // Optionally, navigate directly to the joined wall
        if (response.data && response.data.wall_id) {
          handleEnterJoinedWall(response.data.wall_id);
        }
      } else {
        if (response.status === 401 || response.data?.message?.toLowerCase().includes('password')) {
          // Handle incorrect password
          setPasswordError(true);
          showToast({
            title: "Access Denied",
            description: response.data?.message || "Incorrect password for this wall",
            status: "error",
          });
        } else if (response.status === 404) {
          // Handle wall not found
          showToast({
            title: "Wall Not Found",
            description: response.data?.message || "The wall ID you entered doesn't exist",
            status: "error",
          });
        } else {
          // Handle other errors
          showToast({
            title: "Error",
            description: response.data?.message || "Failed to join wall. Please try again.",
            status: "error",
          });
        }
      }
    } catch (error) {
      console.error('Wall join error:', error);
      showToast({
        title: "Wall join error",
        description: "An unexpected error occurred. Please try again later.",
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Handler for image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    console.log('Image selected:', {
      name: file.name,
      type: file.type,
      size: file.size + ' bytes (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)'
    });
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      console.error('Invalid file type:', file.type);
      showToast({
        title: "Unsupported file type",
        description: "Only JPG, PNG and GIF images are supported.",
        status: "error",
      });
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('File too large:', file.size, 'bytes');
      showToast({
        title: "Image too large",
        description: "The image file is too large. Please select a smaller image (max 5MB).",
        status: "error",
      });
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
      // Save the actual file for uploading later
      setSelectedImage(file);
      setSelectedImageName(file.name);
      
      // Create preview URL for display only
      const imagePreviewUrl = URL.createObjectURL(file);
      setImagePreview(imagePreviewUrl);
      
      showToast({
        title: "Image selected",
        description: "Your wall image has been selected",
        status: "success",
      });
  }

  // Handler for creating a new wall
  const handleCreateWall = async () => {
    // Validate required fields
    if (!wallName || !wallPassword || !wallId) {
      showToast({
        title: "Missing information",
        description: "Wall name, password, and ID are required to create a new wall",
        status: "error",
      });
      return;
    }
    
    // Basic validation of wall ID format (alphanumeric only)
    if (!/^[a-zA-Z0-9_-]+$/.test(wallId)) {
      showToast({
        title: "Invalid Wall ID",
        description: "Wall ID can only contain letters, numbers, underscores, and hyphens",
        status: "error",
      });
      return;
    }
    
    // Check if an image is selected but invalid
    if (selectedImage && !(selectedImage instanceof File)) {
      showToast({
        title: "Invalid image",
        description: "The selected image is invalid. Please select another image.",
        status: "error",
      });
      return;
    }
    
    try {
      // Show loading state
      setIsLoading(true);
      
      // Log selected image details for debugging
      if (selectedImage) {
        console.log('Selected image details for wall creation:', {
          name: selectedImage.name,
          type: selectedImage.type,
          size: selectedImage.size + ' bytes (' + (selectedImage.size / 1024 / 1024).toFixed(2) + ' MB)'
        });
      } else {
        console.log('No image selected for wall creation');
      }
      
      // Prepare wall data for API
      const wallData = {
        name: wallName,
        password: wallPassword,
        wallId: wallId,
        description: wallDescription,
        image: selectedImage // This is the File object from the file input
      };
      
      console.log('Submitting wall creation with data:', {
        name: wallData.name,
        wallId: wallData.wallId,
        hasPassword: !!wallData.password,
        hasDescription: !!wallData.description,
        hasImage: !!wallData.image
      });
      
      // Call the API to create the wall
      const response = await createWall(wallData);
      console.log('Wall creation API response:', response);
      
      if (response.success) {
        // Reload walls to get the updated list including the new wall
        await loadWalls();
        
        showToast({
          title: "Wall created!",
          description: `Your wall "${wallName}" has been created`,
          status: "success",
        });
        
        // Reset form and close modal
        setWallName('');
        setWallPassword('');
        setWallId('');
        setWallDescription('');
        setSelectedImage(null);
        setImagePreview(null);
        setSelectedImageName('No file chosen');
        
        // Also reset the file input element
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        onCreateClose();
        
        // Optionally, navigate directly to the new wall
        if (response.data && response.data.wall && response.data.wall.wall_id) {
          handleEnterJoinedWall(response.data.wall.wall_id);
        } else if (response.data && response.data.wall && response.data.wall.id) {
          // Alternative field name
          handleEnterJoinedWall(response.data.wall.id);
        }
      } else {
        // Reset the file input on error too
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Handle specific error cases
        if (response.status === 409) {
          // Wall ID already exists
          showToast({
            title: "Wall ID already taken",
            description: "Please choose a different Wall ID",
            status: "error",
          });
        } else if (response.status === 413) {
          // File too large
          showToast({
            title: "Image too large",
            description: "The image file is too large. Please select a smaller image (max 5MB).",
            status: "error",
          });
          // Reset image state
          setSelectedImage(null);
          setImagePreview(null);
          setSelectedImageName('No file chosen');
        } else if (response.status === 415) {
          // Unsupported file type
          showToast({
            title: "Unsupported file type",
            description: "Only JPG, PNG and GIF images are supported.",
            status: "error",
          });
          // Reset image state
          setSelectedImage(null);
          setImagePreview(null);
          setSelectedImageName('No file chosen');
        } else if (response.status === 401) {
          // Authentication error
          showToast({
            title: "Authentication error",
            description: "Your session has expired. Please log in again.",
            status: "error",
          });
          setTimeout(() => router.push('/login'), 2000);
        } else {
          // Show specific error message from API if available
          const errorMessage = response.data?.message || 'Failed to create wall';
          console.error('Wall creation failed:', errorMessage);
          showToast({
            title: "Wall creation failed",
            description: errorMessage,
            status: "error",
          });
        }
      }
    } catch (error) {
      console.error('Wall creation error:', error);
      
      // Reset the file input on error
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      showToast({
        title: "Wall creation error",
        description: error.message || "An unexpected error occurred. Please try again later.",
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Handler for entering a wall you've already joined
  const handleEnterJoinedWall = (wallId) => {
    showToast({
      title: "Entering wall",
      description: "You're now entering this whispering wall",
      status: "info",
    });
    // Navigate to the wall page with the wall ID
    router.push(`/wall?id=${wallId}`);
  }

  // Real logout function using auth context
  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      console.log('Logging out user');
      
      // Call the logout function from auth context
      const result = await authLogout();
      
      if (result.success) {
    showToast({
          title: 'Logged Out',
          description: 'You have been successfully logged out',
          status: 'success'
        });
        
        // Clear local user data before redirecting
        setUserProfile({
          name: 'User',
          email: '',
          profilePic: 'https://bit.ly/broken-link'
        });
        
        setWalls([]);
        
        // Redirect to login page with slight delay
        setTimeout(() => {
          router.push('/login');
        }, 500);
      } else {
        throw new Error(result.message || 'Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      showToast({
        title: 'Error',
        description: error.message || 'An error occurred during logout',
        status: 'error'
      });
      
      // Force redirect to login even if server logout fails
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  }
  
  // State for edit wall modal
  const { 
    isOpen: isEditOpen, 
    onOpen: onEditOpen, 
    onClose: onEditClose 
  } = useDisclosure()
  
  // State to track which wall is being edited
  const [editingWall, setEditingWall] = useState(null)
  
  // State for wall edit form fields
  const [editWallName, setEditWallName] = useState('')
  const [editWallDescription, setEditWallDescription] = useState('')
  const [editWallImage, setEditWallImage] = useState(null)
  const [editWallImagePreview, setEditWallImagePreview] = useState(null)
  
  // Handler for opening the edit wall modal
  const handleEditWall = (wall) => {
    setEditingWall(wall)
    setEditWallName(wall.name)
    setEditWallDescription(wall.description || '')
    setEditWallImagePreview(wall.image)
    onEditOpen()
  }
  
  // Handler for saving wall edits
  const handleSaveWallEdit = async () => {
    if (!editWallName.trim()) {
      showToast({
        title: "Missing information",
        description: "Wall name is required",
        status: "error",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Prepare data for API
      const wallData = {
        id: editingWall.id,
        name: editWallName,
        description: editWallDescription,
        image: editWallImage // This would be the new File object if changed
      };
      
      // Call the API to update the wall
      const response = await updateWall(wallData);
      
      if (response.success) {
        // Update the wall in local state
      setWalls(prev => prev.map(wall => 
        wall.id === editingWall.id 
          ? { 
              ...wall, 
              name: editWallName,
              description: editWallDescription,
              image: editWallImagePreview || wall.image
            } 
          : wall
      ));
      
      showToast({
        title: "Wall updated",
        description: `Your wall "${editWallName}" has been updated`,
        status: "success",
      });
        
        // Reload walls to get the updated data from the server
        // This ensures our local state matches the server state
        await loadWalls();
      
      // Close modal and reset state
      onEditClose();
      setEditingWall(null);
      setEditWallName('');
      setEditWallDescription('');
      setEditWallImage(null);
      setEditWallImagePreview(null);
      } else {
        throw new Error(response.data?.message || 'Failed to update wall');
      }
    } catch (error) {
      console.error('Error updating wall:', error);
      showToast({
        title: "Update failed",
        description: error.message || "Failed to update wall. Please try again.",
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Handler for editing image selection
  const editImageInputRef = useRef(null)
  
  const handleEditImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Save the actual file for uploading later
      setEditWallImage(file);
      
      // Create preview URL for display only
      const imagePreviewUrl = URL.createObjectURL(file);
      setEditWallImagePreview(imagePreviewUrl);
      
      showToast({
        title: "Image selected",
        description: "Your new wall image has been selected",
        status: "success",
      });
    }
  }

  // Add state for server errors
  const [serverError, setServerError] = useState(null)
  
  // Reset server error when opening modals
  useEffect(() => {
    if (isCreateOpen || isJoinOpen || isEditOpen || isProfileOpen) {
      setServerError(null)
    }
  }, [isCreateOpen, isJoinOpen, isEditOpen, isProfileOpen])

  return (
    <Box bg={bgColor} minH="100vh">
      <Container maxW="container.xl" py={6}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Flex 
            align="center" 
            justify="space-between" 
            wrap={{ base: "wrap", md: "nowrap" }}
            gap={{ base: 4, md: 0 }}
          >
            <Heading 
              as="h1" 
              size="xl" 
              bgGradient={brandGradient}
              backgroundClip="text"
              mb={{ base: 2, md: 0 }}
              textAlign={{ base: "center", md: "left" }}
              flex={{ base: "100%", md: "auto" }}
            >
              Wink Trap
            </Heading>
            
            <Spacer display={{ base: "none", md: "block" }} />
            
            <Flex 
              gap={4} 
              justify={{ base: "center", md: "flex-end" }}
              width={{ base: "100%", md: "auto" }}
              align="center"
            >
              <Button 
                colorScheme="purple" 
                rounded="full" 
                onClick={onJoinOpen}
                variant="outline"
                w={{ base: "30%", md: "auto" }}
                _hover={{
                  bg: 'purple.800'
                }}
              >
                Join Wall
              </Button>
              <Button 
                colorScheme="brand" 
                rounded="full" 
                onClick={onCreateOpen}
                leftIcon={
                  <Box as="span" fontSize="1.2em">+</Box>
                }
                _hover={{
                  bg: 'brand.400'
                }}
                w={{ base: "30%", md: "auto" }}
              >
                Create Wall
              </Button>
              
              {/* Profile Menu */}
              <Menu>
                <MenuButton
                  as={IconButton}
                  size="md"
                  rounded="full"
                  aria-label="Open user menu"
                  icon={
                    <Avatar 
                      size="sm" 
                      name={userProfile?.name || 'User'} 
                      src={userProfile?.profilePic || 'https://bit.ly/broken-link'}
                      bg="brand.400"
                      color="white"
                    />
                  }
                  variant="ghost"
                  _hover={{
                    bg: 'dark.700'
                  }}
                />
                <MenuList bg="dark.800" borderColor="dark.600">
                  <Box px={3} py={2} borderBottomWidth="1px" borderColor="dark.700">
                    <Text fontWeight="medium" color="white">{userProfile?.name || 'User'}</Text>
                    <Text fontSize="sm" color="gray.400">{userProfile?.email || ''}</Text>
                  </Box>
                  <MenuItem 
                    onClick={onProfileOpen}
                    bg="dark.800"
                    _hover={{ bg: 'dark.700' }}
                    color="gray.200"
                  >
                    Edit Profile
                  </MenuItem>
                  <MenuDivider borderColor="dark.700" />
                  <MenuItem 
                    onClick={handleLogout}
                    bg="dark.800"
                    _hover={{ bg: 'red.900' }}
                    color="red.300"
                    isDisabled={isLoading}
                  >
                    {isLoading ? 'Logging out...' : 'Logout'}
                  </MenuItem>
                </MenuList>
              </Menu>
            </Flex>
          </Flex>

          {/* Subtitle */}
          <Text fontSize="lg" color={textColor} pb={2}>
            Your private conversation spaces
          </Text>
          
          {/* My Walls */}
          <Box>
            <Heading as="h2" size="md" mb={4} color="brand.300">
              My Whispering Walls
            </Heading>
            
            <Grid 
              templateColumns={{
                base: "repeat(1, 1fr)",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(3, 1fr)"
              }}
              gap={6}
            >
              {walls.filter(wall => wall.isJoined).map(wall => (
                <GridItem key={wall.id}>
                  <Card 
                    rounded="xl" 
                    overflow="hidden" 
                    bg={cardBg} 
                    boxShadow="dark-lg"
                    transition="all 0.3s"
                    borderColor="dark.700"
                    borderWidth="1px"
                    _hover={{ 
                      transform: 'translateY(-5px)', 
                      boxShadow: 'dark-lg',
                      borderColor: 'brand.400',
                    }}
                  >
                    <Box position="relative" h="180px">
                      <Image 
                        src={wall.image} 
                        alt={wall.name}
                        objectFit="cover"
                        w="100%"
                        h="100%"
                        fallbackSrc="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"
                        onError={(e) => {
                          console.log(`Error loading image for wall: ${wall.name}`, e);
                          e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe";
                        }}
                      />
                      <Box 
                        position="absolute" 
                        top={2} 
                        right={2}
                      >
                        <Badge 
                          colorScheme="brand" 
                          rounded="full" 
                          px={3} 
                          py={1}
                          bg="brand.400"
                          color="black"
                        >
                          Joined
                        </Badge>
                      </Box>
                      
                      {/* Edit Icon - Only visible for walls created by the current user */}
                      {wall.createdBy === userProfile?.email && (
                        <IconButton
                          position="absolute"
                          bottom={2}
                          right={2}
                          icon={<Box as="span" fontSize="1.2em">✏️</Box>}
                          aria-label="Edit wall"
                          bg="blackAlpha.700"
                          color="white"
                          _hover={{ bg: "blackAlpha.800" }}
                          size="sm"
                          rounded="full"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent navigating to the wall
                            handleEditWall(wall);
                          }}
                        />
                      )}
                    </Box>
                    
                    <CardBody pt={4} pb={2}>
                      <Heading 
                        as="h3" 
                        size="md" 
                        color="brand.300"
                        mb={1}
                      >
                        {wall.name}
                      </Heading>
                      <HStack spacing={1} mb={2}>
                        <Box as="span" color="gray.400" fontSize="sm">
                          {wall.members}
                        </Box>
                        <Box as="span" color="gray.400" fontSize="sm">
                          members
                        </Box>
                      </HStack>
                    </CardBody>
                    
                    <CardFooter pt={0} pb={4}>
                      <Button 
                        width="full" 
                        colorScheme="brand" 
                        size="sm"
                        rounded="full"
                        onClick={() => handleEnterJoinedWall(wall.id)}
                        bgGradient={brandGradient}
                        _hover={{
                          bg: 'brand.400'
                        }}
                      >
                        Enter Wall
                      </Button>
                    </CardFooter>
                  </Card>
                </GridItem>
              ))}
            </Grid>
            
            {walls.filter(wall => wall.isJoined).length === 0 && (
              <Box textAlign="center" p={8} bg="dark.700" rounded="xl">
                <Text color="gray.400">You haven't joined any walls yet</Text>
              </Box>
            )}
          </Box>
        </VStack>
      </Container>

      {/* Create Wall Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} isCentered>
        <ModalOverlay 
          bg="blackAlpha.800"
          backdropFilter="blur(10px)"
        />
        <ModalContent rounded="xl" mx={4} borderColor="brand.500" borderWidth="1px">
          <ModalHeader color="brand.300">Create New Wall</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel color="gray.300">Wall Name</FormLabel>
                <Input 
                  placeholder="Give your wall a name" 
                  value={wallName}
                  onChange={(e) => setWallName(e.target.value)}
                  rounded="lg"
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
                <Input 
                  type="password" 
                  placeholder="Create a password" 
                  value={wallPassword}
                  onChange={(e) => setWallPassword(e.target.value)}
                  rounded="lg"
                  borderColor="dark.600"
                  _hover={{
                    borderColor: 'brand.400'
                  }}
                  _focus={{
                    borderColor: 'brand.300',
                    boxShadow: '0 0 0 1px #ffd43b'
                  }}
                />
                <FormHelperText color="gray.500">All walls require a password for privacy</FormHelperText>
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="gray.300">Wall ID</FormLabel>
                <Input 
                  placeholder="Create a unique ID" 
                  value={wallId}
                  onChange={(e) => setWallId(e.target.value)}
                  rounded="lg"
                  borderColor="dark.600"
                  _hover={{
                    borderColor: 'brand.400'
                  }}
                  _focus={{
                    borderColor: 'brand.300',
                    boxShadow: '0 0 0 1px #ffd43b'
                  }}
                />
                <FormHelperText color="gray.500">This is the ID others will use to join your wall</FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel color="gray.300">Wall Description</FormLabel>
                <Textarea 
                  placeholder="Add a description for your wall" 
                  value={wallDescription}
                  onChange={(e) => setWallDescription(e.target.value)}
                  rounded="lg"
                  borderColor="dark.600"
                  _hover={{
                    borderColor: 'brand.400'
                  }}
                  _focus={{
                    borderColor: 'brand.300',
                    boxShadow: '0 0 0 1px #ffd43b'
                  }}
                  minH="80px"
                />
                <FormHelperText color="gray.500">A brief description about the purpose of this wall</FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel color="gray.300">Upload Wall Image</FormLabel>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                />
                <Flex direction="column" gap={2}>
                  <Button 
                    width="full" 
                    variant="outline" 
                    colorScheme="brand" 
                    rounded="lg"
                    borderColor="brand.400"
                    _hover={{
                      bg: 'dark.700'
                    }}
                    onClick={() => fileInputRef.current.click()}
                  >
                    Choose Image
                  </Button>
                  <Text fontSize="sm" color="gray.500" noOfLines={1}>
                    {selectedImageName}
                  </Text>
                  {imagePreview && (
                    <Box mt={2} rounded="md" overflow="hidden" borderWidth="1px" borderColor="brand.400">
                      <Image 
                        src={imagePreview} 
                        alt="Selected wall image" 
                        maxH="120px" 
                        w="100%" 
                        objectFit="cover"
                      />
                    </Box>
                  )}
                </Flex>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button 
              colorScheme="brand" 
              mr={3} 
              rounded="full"
              bgGradient={brandGradient}
              _hover={{
                bg: 'brand.400'
              }}
              onClick={handleCreateWall}
              isLoading={isLoading}
              loadingText="Creating Wall"
            >
              Create Wall
            </Button>
            <Button 
              variant="outline" 
              onClick={onCreateClose} 
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

      {/* Join Wall Modal */}
      <Modal isOpen={isJoinOpen} onClose={onJoinClose} isCentered>
        <ModalOverlay 
          bg="blackAlpha.800"
          backdropFilter="blur(10px)"
        />
        <ModalContent rounded="xl" mx={4} borderColor="purple.500" borderWidth="1px">
          <ModalHeader color="purple.300">Join Existing Wall</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel color="gray.300">Wall ID</FormLabel>
                <Input 
                  placeholder="Enter wall ID" 
                  value={joinWallId}
                  onChange={(e) => {
                    setJoinWallId(e.target.value);
                    setPasswordError(false);
                  }}
                  rounded="lg"
                  borderColor="dark.600"
                  _hover={{
                    borderColor: 'purple.400'
                  }}
                  _focus={{
                    borderColor: 'purple.300',
                    boxShadow: '0 0 0 1px #da77f2'
                  }}
                />
              </FormControl>

              <FormControl isRequired isInvalid={passwordError}>
                <FormLabel color="gray.300">Password</FormLabel>
                <Input 
                  type="password" 
                  placeholder="Enter wall password" 
                  value={joinPassword}
                  onChange={(e) => {
                    setJoinPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  rounded="lg"
                  borderColor={passwordError ? "red.300" : "dark.600"}
                  _hover={{
                    borderColor: passwordError ? "red.300" : "purple.400"
                  }}
                  _focus={{
                    borderColor: passwordError ? "red.300" : "purple.300",
                    boxShadow: passwordError ? '0 0 0 1px #fc8181' : '0 0 0 1px #da77f2'
                  }}
                />
                {passwordError && (
                  <FormHelperText color="red.300">
                    Incorrect password for this wall
                  </FormHelperText>
                )}
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button 
              colorScheme="purple" 
              mr={3} 
              rounded="full"
              onClick={handleJoinWall}
              bgGradient="linear(to-r, purple.400, brand.400)"
              _hover={{
                bg: 'purple.500'
              }}
            >
              Join Wall
            </Button>
            <Button 
              variant="outline" 
              onClick={onJoinClose} 
              rounded="full"
              color="gray.300"
              borderColor="gray.600"
              _hover={{
                bg: 'dark.700',
                color: 'white',
                borderColor: 'gray.500'
              }}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Profile Edit Modal */}
      <ProfileEditModal 
        isOpen={isProfileOpen} 
        onClose={onProfileClose} 
        userProfile={userProfile} 
        setUserProfile={setUserProfile} 
      />

      {/* Edit Wall Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} isCentered>
        <ModalOverlay 
          bg="blackAlpha.800"
          backdropFilter="blur(10px)"
        />
        <ModalContent rounded="xl" mx={4} borderColor="brand.500" borderWidth="1px" bg="dark.800">
          <ModalHeader color="brand.300">Edit Wall</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel color="gray.300">Wall Name</FormLabel>
                <Input 
                  placeholder="Enter new wall name" 
                  value={editWallName}
                  onChange={(e) => setEditWallName(e.target.value)}
                  rounded="lg"
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
                <FormLabel color="gray.300">Wall Description</FormLabel>
                <Textarea 
                  placeholder="Enter wall description" 
                  value={editWallDescription}
                  onChange={(e) => setEditWallDescription(e.target.value)}
                  rounded="lg"
                  borderColor="dark.600"
                  _hover={{
                    borderColor: 'brand.400'
                  }}
                  _focus={{
                    borderColor: 'brand.300',
                    boxShadow: '0 0 0 1px #ffd43b'
                  }}
                  minH="80px"
                />
                <FormHelperText color="gray.500">A brief description about the purpose of this wall</FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel color="gray.300">Upload New Wall Image</FormLabel>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageSelect}
                  ref={editImageInputRef}
                  style={{ display: 'none' }}
                />
                <Flex direction="column" gap={2}>
                  <Button 
                    width="full" 
                    variant="outline" 
                    colorScheme="brand" 
                    rounded="lg"
                    borderColor="brand.400"
                    _hover={{
                      bg: 'dark.700'
                    }}
                    onClick={() => editImageInputRef.current.click()}
                  >
                    Choose Image
                  </Button>
                  {editWallImagePreview && (
                    <Box mt={2} rounded="md" overflow="hidden" borderWidth="1px" borderColor="brand.400">
                      <Image 
                        src={editWallImagePreview} 
                        alt="Selected wall image" 
                        maxH="120px" 
                        w="100%" 
                        objectFit="cover"
                      />
                    </Box>
                  )}
                </Flex>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button 
              colorScheme="brand" 
              mr={3} 
              rounded="full"
              bgGradient={brandGradient}
              _hover={{
                bg: 'brand.400'
              }}
              onClick={handleSaveWallEdit}
            >
              Save Changes
            </Button>
            <Button 
              variant="outline" 
              onClick={onEditClose} 
              rounded="full"
              color="gray.300"
              borderColor="gray.600"
              _hover={{
                bg: 'dark.700',
                color: 'white',
                borderColor: 'gray.500'
              }}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
