'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Textarea,
  IconButton,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Divider,
  useToast,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Tooltip,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Wrap,
  WrapItem,
  useColorModeValue,
  InputGroup,
  InputRightElement,
  Select,
  Progress,
  useInterval,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Stack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
  Icon
} from '@chakra-ui/react'

// Import API utility functions
import { 
  getWallDetails,
  getWallMembers,
  getWallConfessions,
  postConfession,
  setCrush,
  removeCrush,
  addComment,
  likeComment,
  addReply,
  createPrivateChat,
  getChatMessages,
  sendChatMessage,
  getPrivateChats,
  updateRelationshipStatus as apiUpdateRelationshipStatus
} from '../utils/api'

// Import WebSocket utilities
import useWebSocket, { EVENT_TYPES, CONNECTION_STATUS } from '../utils/websocketService';

export default function WallPage() {
  const router = useRouter()
  const toast = useToast()
  const confessionInputRef = useRef(null)
  const searchParams = useSearchParams()
  const wallId = searchParams.get('id');
  
  // State for the current wall - initialize empty
  const [currentWall, setCurrentWall] = useState({
    id: '',
    name: '',
    description: '',
    image: '',
    members: 0,
    created_at: ''
  })
  
  // State for loading indicators
  const [isLoading, setIsLoading] = useState(false)
  
  // State for wall members - initialize empty
  const [wallMembers, setWallMembers] = useState([]);
  
  // Current user from auth
  const [currentUser, setCurrentUser] = useState(null);
  
  // State for the members tab selection
  const [tabIndex, setTabIndex] = useState(0);
  
  // State to track if Chats tab is locked
  const [isChatsTabLocked, setIsChatsTabLocked] = useState(true);
  
  // State for crush confirmation modal
  const { 
    isOpen: isCrushConfirmOpen, 
    onOpen: onCrushConfirmOpen, 
    onClose: onCrushConfirmClose 
  } = useDisclosure();
  
  // State to track which user we're about to crush on
  const [selectedCrush, setSelectedCrush] = useState(null);
  
  // State for confessions - initialize empty
  const [confessions, setConfessions] = useState([]);
  
  // State for new confession
  const [newConfession, setNewConfession] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // State for new comments
  const [newComments, setNewComments] = useState({})
  
  // State for new replies
  const [newReplies, setNewReplies] = useState({})
  
  // State for which comment sections are expanded
  const [expandedComments, setExpandedComments] = useState({})
  
  // State for which reply forms are shown
  const [showReplyForms, setShowReplyForms] = useState({})
  
  // State for matches/mutual crushes
  const [mutualCrushes, setMutualCrushes] = useState([]);
  
  // State for private chat modal
  const { 
    isOpen: isPrivateChatOpen, 
    onOpen: onPrivateChatOpen, 
    onClose: onPrivateChatClose 
  } = useDisclosure();
  
  // State for current active chat
  const [activeChat, setActiveChat] = useState(null);
  
  // State for messages in private chats
  const [privateMessages, setPrivateMessages] = useState({});
  
  // State for current message being typed
  const [currentMessage, setCurrentMessage] = useState('');
  
  // State for relationship status
  const [relationships, setRelationships] = useState({});
  
  // Relationship status options
  const relationshipStatusOptions = [
    "Just matched",
    "Getting to know each other",
    "Talking regularly",
    "Planning to meet",
    "Met in person",
    "Dating casually",
    "Exclusive relationship",
    "Serious relationship"
  ];
  
  // State for typing indicators
  const [typingIndicators, setTypingIndicators] = useState({});
  
  // State for unread message counts
  const [unreadMessages, setUnreadMessages] = useState({});
  
  // State for anniversary reminders
  const [showAnniversaryReminder, setShowAnniversaryReminder] = useState(false);
  const [anniversaryData, setAnniversaryData] = useState(null);
  
  // State for relationship status dialog
  const { 
    isOpen: isStatusOpen, 
    onOpen: onStatusOpen, 
    onClose: onStatusClose 
  } = useDisclosure();
  
  // Reference for status dialog
  const statusCancelRef = useRef();
  
  // UI states
  const bgColor = 'dark.900'
  const cardBg = 'dark.800'
  const textColor = 'gray.100'
  const brandGradient = 'linear(to-r, brand.300, brand.500)'
  const crushButtonBg = useColorModeValue('red.400', 'red.500')
  const crushButtonHoverBg = useColorModeValue('red.500', 'red.600')
  const pinkGradient = 'linear(to-r, pink.400, purple.500)'

  // New confession modal
  const { isOpen, onOpen, onClose } = useDisclosure()

  // Add state for tracking status update loading
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // State for WebSocket connection
  const [wsConnected, setWsConnected] = useState(false);
  
  // Initialize WebSocket connection when user and wall ID are available
  const {
    connectionStatus: wsStatus,
    error: wsError,
    sendChatMessage: wsSendChatMessage,
    sendTypingIndicator,
    subscribe: wsSubscribe
  } = useWebSocket(
    currentUser?.id,
    wallId
  );
  
  // Update connection status for UI indicators
  useEffect(() => {
    setWsConnected(wsStatus === CONNECTION_STATUS.CONNECTED);
    
    if (wsStatus === CONNECTION_STATUS.CONNECTED) {
      console.log('WebSocket connected and ready for chat');
      
      // Show toast for development/testing purposes
      showToast({
        title: "Chat Connected",
        description: "Real-time chat connection established",
        status: "success",
        duration: 3000
      });
    } else if (wsStatus === CONNECTION_STATUS.ERROR) {
      console.error('WebSocket connection error:', wsError);
      
      // Show error toast
      showToast({
        title: "Chat Connection Error",
        description: wsError || "Failed to establish real-time chat connection",
        status: "error"
      });
    }
  }, [wsStatus, wsError]);
  
  // Subscribe to incoming chat messages
  useEffect(() => {
    if (wsStatus === CONNECTION_STATUS.CONNECTED) {
      // Subscribe to chat messages
      const unsubscribeChat = wsSubscribe(EVENT_TYPES.CHAT_MESSAGE, (data) => {
        console.log('WebSocket chat message received:', data);
        
        // Skip processing if this is our own message (already shown via optimistic update)
        if (data.sender_id === currentUser?.id) {
          return;
        }
        
        // Find which active chat this message belongs to
        const matchId = findMatchIdFromChatId(data.chat_id);
        if (!matchId) {
          console.log('Could not find match for chat ID:', data.chat_id);
          return;
        }
        
        // Format the message for UI
        const newMessage = {
          id: `msg-ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          sender: data.is_system_message ? 'system' : parseInt(data.sender_id),
          senderName: data.sender_name || (data.is_system_message ? 'system' : 'Unknown'),
          senderAvatar: data.sender_avatar,
          text: data.message,
          timestamp: data.timestamp || new Date().toISOString()
        };
        
        // Add the message to the chat
        setPrivateMessages(prev => ({
          ...prev,
          [matchId]: [...(prev[matchId] || []), newMessage]
        }));
        
        // Update unread counter if we're not currently viewing this chat
        if (activeChat?.id !== matchId) {
          setUnreadMessages(prev => ({
            ...prev,
            [matchId]: (prev[matchId] || 0) + 1
          }));
          
          // Show notification toast for new message
          if (!data.is_system_message) {
            const matchUser = mutualCrushes.find(match => match.id === matchId)?.user;
            if (matchUser) {
              showToast({
                title: `New message from ${matchUser.name}`,
                description: data.message,
                status: "info"
              });
            }
          }
        }
      });
      
      // Subscribe to typing indicators
      const unsubscribeTyping = wsSubscribe(EVENT_TYPES.TYPING_INDICATOR, (data) => {
        console.log('WebSocket typing indicator received:', data);
        
        // Skip processing if this is our own typing indicator
        if (data.sender_id === currentUser?.id) {
          return;
        }
        
        // Find which active chat this typing indicator belongs to
        const matchId = findMatchIdFromChatId(data.chat_id);
        if (!matchId) return;
        
        // Update typing indicator state
        setTypingIndicators(prev => ({
          ...prev,
          [matchId]: data.is_typing
        }));
        
        // Clear typing indicator after a timeout
        if (data.is_typing) {
          setTimeout(() => {
            setTypingIndicators(prev => ({
              ...prev,
              [matchId]: false
            }));
          }, 3000);
        }
      });
      
      // Subscribe to crush updates and mutual match notifications
      const unsubscribeCrush = wsSubscribe(EVENT_TYPES.CRUSH_UPDATE, (data) => {
        console.log('WebSocket crush update received:', data);
        
        // Refresh member data to get the latest crush information
        refreshMemberData();
      });
      
      const unsubscribeMatch = wsSubscribe(EVENT_TYPES.MUTUAL_MATCH, (data) => {
        console.log('WebSocket mutual match notification received:', data);
        
        // Check for mutual crushes to update UI
        checkForMutualCrushes();
        
        // Show celebration toast for new match
        if (data.target_user_id === currentUser?.id || data.user_id === currentUser?.id) {
          const otherUserId = data.user_id === currentUser?.id ? data.target_user_id : data.user_id;
          const otherUser = wallMembers.find(m => m.id === parseInt(otherUserId));
          
          if (otherUser) {
            showToast({
              title: "💕 New Mutual Crush! 💕",
              description: `You and ${otherUser.name} both have crushes on each other! You can now chat privately.`,
              status: "success",
              duration: 8000
            });
          }
        }
      });
      
      // Clean up subscriptions on component unmount or when connection changes
      return () => {
        unsubscribeChat();
        unsubscribeTyping();
        unsubscribeCrush();
        unsubscribeMatch();
      };
    }
  }, [wsStatus, currentUser?.id, wallId, mutualCrushes]);
  
  // Helper function to find matchId from chatId
  const findMatchIdFromChatId = (chatId) => {
    const match = mutualCrushes.find(m => m._chatId === chatId);
    return match ? match.id : null;
  };

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

  // Special effect to force mutual crush detection on initial page load
  useEffect(() => {
    const forceInitialMutualCrushCheck = async () => {
      console.log('🔄 INITIAL PAGE LOAD: Force-checking for mutual crushes');
      
      // Immediately try to check for mutual crushes
      await checkForMutualCrushes();
      
      // Then set up a series of frequent checks over the first few seconds
      const checkIntervals = [500, 1000, 2000, 3000, 5000];
      
      checkIntervals.forEach(interval => {
        setTimeout(async () => {
          console.log(`🔄 INITIAL CHECK (${interval}ms): Checking for mutual crushes`);
          await checkForMutualCrushes();
        }, interval);
      });
    };
    
    // Run the force check as soon as the component mounts
    forceInitialMutualCrushCheck();
    
    // Also refresh whenever wall ID changes
  }, [wallId]); // Only run this when wall ID changes or on first load

  // Load wall data on mount
  useEffect(() => {
    const loadWallData = async () => {
      try {
        // Set initial loading state
        setIsLoading(true);
        
        // First fetch members data - this is critical for mutual crush detection
        console.log('💨 PRIORITY LOADING: Fetching members data first for mutual crush detection');
        const membersResponse = await getWallMembers(wallId);
        
        if (membersResponse.success && membersResponse.data && membersResponse.data.members) {
          // Set the members data
          setWallMembers(membersResponse.data.members);
          
          // Find the current user from the members list
          const currentUserFromMembers = membersResponse.data.members.find(
            member => member.id === membersResponse.data.current_user_id
          );
          
          if (currentUserFromMembers) {
            console.log('💨 PRIORITY LOADING: Current user found, setting current user data');
            setCurrentUser(currentUserFromMembers);
            
            // Immediately check for mutual crushes as soon as we have the user data
            console.log('💨 PRIORITY LOADING: Immediate mutual crush check');
            checkForMutualCrushes();
          } else {
            console.error('Current user not found in members list');
          }
        } else {
          console.error('Error loading wall members:', membersResponse);
          // Set empty members array if API call fails
          setWallMembers([]);
    
          showToast({
            title: 'Error Loading Members',
            description: 'Could not load wall members. Please try again later.',
            status: 'error'
          });
        }
        
        // Then fetch wall details in parallel with confessions
        console.log('Loading remaining wall data...');
        
        const wallPromise = getWallDetails(wallId);
        const confessionsPromise = getWallConfessions(wallId);
        
        // Wait for both promises to resolve
        const [wallResponse, confessionsResponse] = await Promise.all([wallPromise, confessionsPromise]);
        
        if (wallResponse.success && wallResponse.data && wallResponse.data.wall) {
          // Set the wall data from the API
          setCurrentWall({
            id: wallResponse.data.wall.id,
            name: wallResponse.data.wall.name,
            description: wallResponse.data.wall.description || '',
            image: wallResponse.data.wall.image || 'https://images.unsplash.com/photo-1522441815192-d9f04eb0615c',
            members: wallResponse.data.wall.members || 0,
            created_at: wallResponse.data.wall.created_at,
            createdBy: wallResponse.data.wall.created_by
          });
          
          showToast({
            title: `Entered ${wallResponse.data.wall.name}`,
            description: 'You have entered this wall',
            status: 'info'
          });
        } else {
          // Fallback to a default wall if API call fails
          console.error('Error loading wall details:', wallResponse);
          setCurrentWall({
      id: wallId,
            name: 'Private Wall',
            description: 'A private conversation space',
      image: 'https://images.unsplash.com/photo-1522441815192-d9f04eb0615c',
            members: 0,
            created_at: new Date().toISOString()
          });
          
          showToast({
            title: 'Error Loading Wall',
            description: 'Could not load wall details. Please try again later.',
            status: 'error'
          });
        }
        
        // Handle confessions response
        if (confessionsResponse.success && confessionsResponse.data && confessionsResponse.data.confessions) {
          // Set the confessions data
          setConfessions(confessionsResponse.data.confessions);
        } else {
          console.error('Error loading wall confessions:', confessionsResponse);
          // Set empty confessions array if API call fails
          setConfessions([]);
    
    showToast({
            title: 'Error Loading Confessions',
            description: 'Could not load wall confessions. Please try again later.',
            status: 'warning'
          });
        }
        
        // Run a final check for mutual crushes after all data is loaded
        console.log('All data loaded, final mutual crush check');
    checkForMutualCrushes();
      } catch (error) {
        console.error('Error in loadWallData:', error);
        
        // Set fallback data if there's an error
        setCurrentWall({
          id: wallId,
          name: 'Private Wall',
          description: 'A private conversation space',
          image: 'https://images.unsplash.com/photo-1522441815192-d9f04eb0615c',
          members: 0,
          created_at: new Date().toISOString()
        });
        
        setWallMembers([]);
        setConfessions([]);
        
        showToast({
          title: 'Connection Error',
          description: 'Could not connect to the server. Please try again later.',
          status: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    // Load data when the component mounts
    if (wallId) {
      loadWallData();
      
      // Set up periodic refresh for member data and mutual crush checks
      const refreshInterval = setInterval(() => {
        console.log('🔄 Periodic refresh: Updating member data and checking for mutual crushes');
        refreshMemberData();
      }, 30000); // Refresh every 30 seconds
      
      // Clean up interval on component unmount
      return () => clearInterval(refreshInterval);
    }
    
  }, [wallId]);

  // Function to check for mutual crushes
  const checkForMutualCrushes = async () => {
    try {
      // First, refresh wall member data to ensure we have the latest
      console.log('Refreshing wall members data before checking for mutual crushes');
      
      // Skip if we don't have a wall ID or user is not set yet
      if (!wallId || !currentUser) {
        console.log('Cannot check for mutual crushes: no wall ID or current user not set');
        return;
      }
      
      // Get fresh data from the server
      const membersResponse = await getWallMembers(wallId);
      
      if (!membersResponse.success || !membersResponse.data || !membersResponse.data.members) {
        console.error('Failed to refresh wall members:', membersResponse);
        return;
      }
      
      // Update the members data with fresh data
      const latestMembers = membersResponse.data.members;
      setWallMembers(latestMembers);
      
      console.log('Refreshed wall members data, now checking for mutual crushes...');
      
      // If current user is not in the members list, return early
      const currentUserData = latestMembers.find(m => m.id === currentUser.id);
      
      if (!currentUserData) {
        console.log('Current user data not found in refreshed wall members');
        return;
      }
      
      // Log the crush information
      if (currentUserData.hasCrushOn) {
        console.log(`Current user has crush on user ID: ${currentUserData.hasCrushOn}`);
        const crushTarget = latestMembers.find(m => m.id === currentUserData.hasCrushOn);
        console.log('Crush target:', crushTarget);
        
        if (crushTarget && crushTarget.hasCrushOn === currentUser.id) {
          console.log('MUTUAL CRUSH DETECTED! 💕');
        }
      } else {
        console.log('Current user does not have a crush on anyone');
      }
      
      // Find all users who have a crush on the current user
      const admirers = latestMembers.filter(m => m.hasCrushOn === currentUser.id);
      console.log('Users who have a crush on current user:', admirers);
      
    const matches = [];
    
      // Check for mutual crushes - anyone the current user has a crush on who also has a crush on them
      for (const member of latestMembers) {
      if (member.id === currentUser.id) {
        // Skip current user
          continue;
      }
      
      // If current user has crush on this member AND this member has crush on current user
        const isMutual = currentUserData.hasCrushOn === member.id && member.hasCrushOn === currentUser.id;
        
        if (isMutual) {
          console.log(`Mutual crush found with ${member.name} (ID: ${member.id})`);
          
          // Create a unique ID for this match that works in both directions
          const matchId = `match-${Math.min(currentUser.id, member.id)}-${Math.max(currentUser.id, member.id)}`;
          
          // Create the chat in the database as soon as we detect the mutual crush
          console.log(`Creating chat for mutual crush with ${member.name}`);
          try {
            const chatResponse = await createPrivateChat({
              wall_id: wallId,
              target_user_id: member.id
            });
            
            console.log('Chat creation response:', chatResponse);
            
            if (chatResponse.success) {
              console.log(`Successfully created or confirmed chat with ID: ${chatResponse.data.chat_id}`);
              
              // Store the chat ID for future reference
              const match = {
                id: matchId,
                user: member,
                matchTime: new Date().toISOString(),
                _chatId: chatResponse.data.chat_id
              };
              
              matches.push(match);
            } else {
              console.error('Error creating chat:', chatResponse);
              
              // Still add the match even if chat creation failed
              // (we'll retry chat creation when they click to open it)
        matches.push({
                id: matchId,
          user: member,
          matchTime: new Date().toISOString()
        });
      }
          } catch (error) {
            console.error('Error creating chat for mutual crush:', error);
            
            // Still add the match even if there was an error
            matches.push({
              id: matchId,
              user: member,
              matchTime: new Date().toISOString()
            });
          }
        }
      }
      
      console.log('Total mutual crushes found:', matches.length);
      
      // If we found matches and there were none before, or the count increased
      const hadNoMatchesBefore = mutualCrushes.length === 0;
      const foundNewMatches = matches.length > mutualCrushes.length;
      
      // Set mutual crushes - only update if we found something or had nothing before
      if (matches.length > 0) {
        // Check if we need to add any new matches that weren't there before
        const existingMatchIds = mutualCrushes.map(m => m.id);
        const newMatches = matches.filter(match => !existingMatchIds.includes(match.id));
        
        if (newMatches.length > 0 || hadNoMatchesBefore) {
          console.log('Setting or updating mutual crushes:', matches);
    setMutualCrushes(matches);
        } else {
          console.log('No new matches found, keeping existing state');
        }
      }
    
    // If we found a new match that wasn't there before, celebrate!
    const newMatches = matches.filter(match => 
      !mutualCrushes.some(existing => existing.id === match.id)
    );
    
    if (newMatches.length > 0) {
        console.log('New mutual crush match found! Showing toast notification.');
      showToast({
        title: "It's a Match!",
        description: `You and ${newMatches[0].user.name} both have crushes on each other! You can now chat privately.`,
        status: "success"
        });
      }
      
      // Update the chats tab lock status
      if (matches.length > 0) {
        setIsChatsTabLocked(false);
      } else {
        setIsChatsTabLocked(true);
      }
    } catch (error) {
      console.error('Error checking for mutual crushes:', error);
    }
  };

  // Function to refresh member data and check for mutual crushes
  const refreshMemberData = async () => {
    console.log('📊 Refreshing wall member data...');
    
    if (!wallId || !currentUser) {
      console.log('Cannot refresh: no wall ID or current user not set');
      return;
    }
    
    try {
      // Show subtle loading indicator or toast for refresh
      const loadingToast = showToast({
        title: "Refreshing",
        description: "Updating member data...",
        status: "info",
        duration: 2000,
        isClosable: true
      });
      
      // Fetch fresh members data
      const membersResponse = await getWallMembers(wallId);
      
      if (membersResponse.success && membersResponse.data && membersResponse.data.members) {
        // Update the members state
        setWallMembers(membersResponse.data.members);
        console.log('📊 Member data refreshed successfully with', membersResponse.data.members.length, 'members');
        
        // After refreshing data, check for mutual crushes
        await checkForMutualCrushes();
      } else {
        console.error('Error refreshing wall members:', membersResponse);
        
        showToast({
          title: 'Refresh Failed',
          description: 'Could not update member data. Please try again.',
          status: 'error'
        });
      }
    } catch (error) {
      console.error('Error in refreshMemberData:', error);
      
      showToast({
        title: 'Connection Error',
        description: 'Could not connect to the server. Please try again later.',
        status: 'error'
      });
    }
  };

  // Handle new confession submission
  const handleConfessionSubmit = async (e) => {
    e.preventDefault();
    
    if (!newConfession.trim()) {
      showToast({
        title: 'Empty confession',
        description: 'Please enter some text for your confession',
        status: 'warning'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call the real API to post the confession
      const response = await postConfession({
        wall_id: wallId,
        text: newConfession
      });
      
      if (response.success && response.data && response.data.confession) {
        // Add the new confession to the beginning of the array
        setConfessions([response.data.confession, ...confessions]);
        
        // Clear the input and close the modal
      setNewConfession('');
      onClose();
      
      showToast({
        title: 'Confession posted',
        description: 'Your anonymous confession has been posted to the wall. It will be automatically deleted after 24 hours.',
        status: 'success'
      });
      } else {
        // Show error toast if the API call failed
        showToast({
          title: 'Failed to post confession',
          description: response.data?.message || 'An unknown error occurred',
          status: 'error'
        });
      }
    } catch (error) {
      console.error('Error posting confession:', error);
      
      showToast({
        title: 'Connection error',
        description: 'Could not connect to the server. Please try again later.',
        status: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle comment submission
  const handleCommentSubmit = async (confessionId) => {
    if (!newComments[confessionId] || !newComments[confessionId].trim()) {
      showToast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment',
        status: 'warning'
      });
      return;
    }
    
    try {
      // Show loading state for the specific confession
      setIsSubmitting(true);
      
      // Call the real API to post the comment
      const response = await addComment({
        confession_id: confessionId,
        text: newComments[confessionId]
      });
      
      if (response.success && response.data && response.data.comment) {
    // Update the confessions array with the new comment
    const updatedConfessions = confessions.map(confession => {
      if (confession.id === confessionId) {
        return {
          ...confession,
              comments: [...confession.comments, {
                id: response.data.comment.id,
                userName: response.data.comment.userName,
                userAvatar: response.data.comment.userAvatar,
                text: response.data.comment.text,
                timestamp: response.data.comment.timestamp,
                likes: 0,
                replies: []
              }]
        };
      }
      return confession;
    });
    
    setConfessions(updatedConfessions);
    
    // Clear the comment input
    setNewComments({
      ...newComments,
      [confessionId]: ''
    });
    
    showToast({
      title: 'Comment posted',
      description: 'Your comment has been added to the confession',
      status: 'success'
    });
      } else {
        // Show error toast if the API call failed
        showToast({
          title: 'Failed to post comment',
          description: response.data?.message || 'An unknown error occurred',
          status: 'error'
        });
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      
      showToast({
        title: 'Connection error',
        description: 'Could not connect to the server. Please try again later.',
        status: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reply submission
  const handleReplySubmit = async (confessionId, commentId) => {
    const replyKey = `${confessionId}-${commentId}`;
    
    if (!newReplies[replyKey] || !newReplies[replyKey].trim()) {
      showToast({
        title: 'Empty reply',
        description: 'Please enter some text for your reply',
        status: 'warning'
      });
      return;
    }
    
    try {
      // Show loading state
      setIsSubmitting(true);
      
      // Create reply data
      const replyData = {
        comment_id: commentId,
        text: newReplies[replyKey]
      };
      
      // Call the real API to post the reply
      const response = await addReply(replyData);
      
      if (response.success && response.data && response.data.reply) {
    // Update the confessions array with the new reply
    const updatedConfessions = confessions.map(confession => {
      if (confession.id === confessionId) {
        return {
          ...confession,
          comments: confession.comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                    replies: comment.replies ? [...comment.replies, response.data.reply] : [response.data.reply]
              };
            }
            return comment;
          })
        };
      }
      return confession;
    });
    
    setConfessions(updatedConfessions);
    
    // Clear the reply input
    setNewReplies({
      ...newReplies,
      [replyKey]: ''
    });
    
    // Hide the reply form
    setShowReplyForms({
      ...showReplyForms,
      [replyKey]: false
    });
    
    showToast({
      title: 'Reply posted',
      description: 'Your reply has been added to the comment',
      status: 'success'
    });
      } else {
        // Show error toast if the API call failed
        showToast({
          title: 'Failed to post reply',
          description: response.data?.message || 'An unknown error occurred',
          status: 'error'
        });
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      
      showToast({
        title: 'Connection error',
        description: 'Could not connect to the server. Please try again later.',
        status: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle like action
  const handleLike = (confessionId) => {
    // Update the confessions array with the incremented like count
    const updatedConfessions = confessions.map(confession => {
      if (confession.id === confessionId) {
        return {
          ...confession,
          likes: confession.likes + 1
        };
      }
      return confession;
    });
    
    setConfessions(updatedConfessions);
  };

  // Handle comment like
  const handleCommentLike = async (confessionId, commentId) => {
    try {
      // Check if the comment is already liked by looking at the current state
      const confession = confessions.find(c => c.id === confessionId);
      if (!confession) return;
      
      const comment = confession.comments.find(c => c.id === commentId);
      if (!comment) return;
      
      const currentlyLiked = comment.isLiked;
      const action = currentlyLiked ? 'unlike' : 'like';
      
      // Optimistically update the UI
    const updatedConfessions = confessions.map(confession => {
      if (confession.id === confessionId) {
        return {
          ...confession,
          comments: confession.comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                  likes: currentlyLiked ? Math.max(0, comment.likes - 1) : comment.likes + 1,
                  isLiked: !currentlyLiked
              };
            }
            return comment;
          })
        };
      }
      return confession;
    });
    
    setConfessions(updatedConfessions);
      
      // Call the API to persist the like/unlike
      const response = await likeComment({
        comment_id: commentId,
        action: action
      });
      
      if (!response.success) {
        // Revert the optimistic update if the API call fails
        setConfessions(confessions);
        
        showToast({
          title: `Failed to ${action} comment`,
          description: response.data?.message || 'An unknown error occurred',
          status: 'error'
        });
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      
      showToast({
        title: 'Connection error',
        description: 'Could not connect to the server. Please try again later.',
        status: 'error'
      });
    }
  };

  // Toggle comments visibility
  const toggleComments = (confessionId) => {
    setExpandedComments({
      ...expandedComments,
      [confessionId]: !expandedComments[confessionId]
    });
  };

  // Toggle reply form visibility
  const toggleReplyForm = (confessionId, commentId) => {
    const replyKey = `${confessionId}-${commentId}`;
    setShowReplyForms({
      ...showReplyForms,
      [replyKey]: !showReplyForms[replyKey]
    });
  };

  // Handler for going back to home
  const handleBackToHome = () => {
    router.push('/');
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };
  
  // Calculate time remaining until expiration
  const getTimeRemaining = (expiresAt) => {
    const total = new Date(expiresAt) - new Date();
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    
    if (total <= 0) {
      return "Expired";
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    
    return `${minutes}m left`;
  };

  // Handle setting a crush
  const handleSetCrush = (memberId) => {
    // Check if user already has a crush on someone else
    const currentUserData = wallMembers.find(member => member.id === currentUser.id);
    
    if (currentUserData && currentUserData.hasCrushOn && currentUserData.hasCrushOn !== memberId) {
      // Show warning toast that they need to remove their current crush first
      showToast({
        title: "Only One Crush Allowed",
        description: "You can only have one crush at a time. Please remove your current crush first.",
        status: "warning"
      });
      return;
    }
    
    // Open confirmation modal and set the selected crush
    setSelectedCrush(memberId);
    onCrushConfirmOpen();
  };
  
  // Confirm and set crush - updated to check for mutual crushes
  const confirmSetCrush = async () => {
    // Close the modal
    onCrushConfirmClose();
    
    if (!selectedCrush) return;
    
    try {
      // Call the real API to set the crush
      const response = await setCrush({
        wall_id: wallId,
        target_user_id: selectedCrush
      });
      
      if (response.success) {
        // Optimistically update the UI with the new crush
        const now = response.data?.crushSetTime || new Date().toISOString();
        
        // Update the wall members state to reflect the crush change
        const updatedMembers = wallMembers.map(member => {
          // Update current user's crush
      if (member.id === currentUser.id) {
        return {
          ...member,
          hasCrushOn: selectedCrush,
              crushSetTime: now
        };
      }
      
          // Increment the target's crush count
      if (member.id === selectedCrush) {
          return {
            ...member,
            crushCount: member.crushCount + 1
          };
      }
      
      return member;
    });
    
        setWallMembers(updatedMembers);
    
    showToast({
      title: "Crush set!",
      description: "Your crush has been secretly recorded. They'll see only the count of admirers. You can remove this crush after 4 hours.",
      status: "success"
    });
    
        // Check for mutual crushes multiple times with increasing delays
        // This helps ensure the server data is updated before checking
        console.log('Scheduling multiple mutual crush checks after setting crush');
        
        // First check immediately 
        checkForMutualCrushes();
        
        // Second check after a short delay
    setTimeout(() => {
          console.log('Second mutual crush check after setting crush (1s)');
          checkForMutualCrushes();
        }, 1000);
        
        // Final check after a longer delay
        setTimeout(() => {
          console.log('Final mutual crush check after setting crush (3s)');
          checkForMutualCrushes();
        }, 3000);
        
      } else {
        showToast({
          title: "Failed to set crush",
          description: response.data?.message || "An unknown error occurred",
          status: "error"
        });
      }
    } catch (error) {
      console.error('Error setting crush:', error);
      
      showToast({
        title: "Connection error",
        description: "Could not connect to the server. Please try again later.",
        status: "error"
      });
    }
  };
  
  // Handle opening a chat with a mutual crush
  const handleOpenChat = async (match) => {
    try {
      console.log('Opening chat with match:', match);
      
      // Validate match has required properties
      if (!match || !match.id || !match.user) {
        console.error('Invalid match object:', match);
        showToast({
          title: 'Chat Error',
          description: 'Could not open chat: invalid data',
          status: 'error'
        });
        return;
      }
      
      // Set the active chat
      setActiveChat(match);
      
      // Create or get existing private chat in the database
      console.log('Creating/retrieving private chat with user ID:', match.user.id);
      const chatResponse = await createPrivateChat({
        wall_id: wallId,
        target_user_id: match.user.id
      });
      
      console.log('Chat creation response:', chatResponse);
      
      if (!chatResponse.success) {
        console.error('Error creating chat:', chatResponse);
        showToast({
          title: 'Chat Error',
          description: chatResponse.data?.message || 'Could not create private chat',
          status: 'error'
        });
        return;
      }
      
      const chatId = chatResponse.data.chat_id;
      console.log('Retrieved chat ID:', chatId);
      
      // Save chat ID for sending messages
      match._chatId = chatId;
      
      // Load messages from the database
      const messagesResponse = await getChatMessages({
        wall_id: wallId,
        chat_id: chatId
      });
      
      console.log('Retrieved messages:', messagesResponse);
      
      if (messagesResponse.success && messagesResponse.data.messages) {
        console.log('Messages count:', messagesResponse.data.messages.length);
        
        // Format messages for the UI
        const formattedMessages = messagesResponse.data.messages.map(msg => ({
          id: `msg-${msg.id}`,
          sender: msg.is_system_message === "1" ? 'system' : parseInt(msg.sender_id),
          senderName: msg.is_system_message === "1" ? 'system' : msg.sender_name,
          senderAvatar: msg.is_system_message === "1" ? null : msg.sender_avatar,
          text: msg.message,
          timestamp: msg.created_at
        }));
        
        // Update the local state with messages from the database
      setPrivateMessages(prev => ({
        ...prev,
          [match.id]: formattedMessages
        }));
      } else {
        // Initialize with empty messages array if we couldn't load messages
        setPrivateMessages(prev => ({
          ...prev,
          [match.id]: []
        }));
        
        console.error('Failed to load messages:', messagesResponse);
    }
    
    // Clear unread message count when opening chat
    setUnreadMessages(prev => ({
      ...prev,
      [match.id]: 0
    }));
    
      // Open the modal
      console.log('Opening private chat modal');
    onPrivateChatOpen();
    } catch (error) {
      console.error('Error opening chat:', error);
      showToast({
        title: 'Chat Error',
        description: 'Could not open chat: ' + error.message,
        status: 'error'
      });
    }
  };
  
  // Update the handleSendMessage function to use WebSockets
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !activeChat) return;
    
    try {
      // Get the chat_id from the activeChat object where we stored it
      const chatId = activeChat._chatId;
      
      // If no chat ID is available, try to get it first
      if (!chatId) {
        console.log('No chat ID found, retrieving it first');
        const chatResponse = await createPrivateChat({
          wall_id: wallId,
          target_user_id: activeChat.user.id
        });
        
        if (!chatResponse.success) {
          showToast({
            title: 'Chat Error',
            description: 'Failed to access chat: ' + (chatResponse.data?.message || 'Unknown error'),
            status: 'error'
          });
          return;
        }
        
        // Store the chat ID for future use
        activeChat._chatId = chatResponse.data.chat_id;
      }
      
      console.log('Sending message to chat ID:', activeChat._chatId);
      
      // Create a temporary message for immediate display
      const tempMessage = {
        id: `msg-temp-${Date.now()}`,
      sender: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: currentMessage,
      timestamp: new Date().toISOString()
    };
    
      // Add message to local state immediately (optimistic update)
    setPrivateMessages(prev => ({
      ...prev,
        [activeChat.id]: [...(prev[activeChat.id] || []), tempMessage]
    }));
    
    // Clear input
    setCurrentMessage('');
      
      // Try to send via WebSocket first if connected
      let wsSuccess = false;
      if (wsConnected) {
        wsSuccess = wsSendChatMessage(
          activeChat._chatId,
          tempMessage.text,
          false
        );
      }
      
      // If WebSocket send failed or not connected, fall back to REST API
      if (!wsSuccess) {
        console.log('WebSocket send failed or not connected, using REST API fallback');
        
        // Send message to the server
        const messageResponse = await sendChatMessage({
          wall_id: wallId,
          chat_id: activeChat._chatId,
          message: tempMessage.text
        });
        
        console.log('Message send response:', messageResponse);
        
        if (!messageResponse.success) {
          console.error('Failed to send message:', messageResponse);
          
          // Show error toast
          showToast({
            title: 'Message Failed',
            description: 'Failed to send message: ' + (messageResponse.data?.message || 'Unknown error'),
            status: 'error'
          });
          
          // Remove the temporary message
          setPrivateMessages(prev => ({
            ...prev,
            [activeChat.id]: prev[activeChat.id].filter(msg => msg.id !== tempMessage.id)
          }));
          
          // Restore the message text in the input
          setCurrentMessage(tempMessage.text);
        } else if (messageResponse.data) {
          // Replace the temp message with the real one from the server
          const realMessage = {
            id: `msg-${messageResponse.data.data.id}`,
            sender: parseInt(messageResponse.data.data.sender_id),
            senderName: messageResponse.data.data.sender_name,
            senderAvatar: messageResponse.data.data.sender_avatar,
            text: messageResponse.data.data.message,
            timestamp: messageResponse.data.data.created_at
          };
          
          setPrivateMessages(prev => ({
          ...prev,
            [activeChat.id]: prev[activeChat.id].map(msg => 
              msg.id === tempMessage.id ? realMessage : msg
            )
        }));
      }
    } else {
        console.log('Message sent successfully via WebSocket');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      showToast({
        title: 'Chat Error',
        description: 'Failed to send message: ' + error.message,
        status: 'error'
      });
    }
  };
  
  // Add typing indicator functionality to chat input
  useEffect(() => {
    if (wsConnected && activeChat && activeChat._chatId) {
      // Only send typing indicator if we're actively typing
      if (currentMessage.trim().length > 0) {
        // Send typing indicator via WebSocket
        sendTypingIndicator(activeChat._chatId, true);
        
        // Clear typing indicator after 3 seconds of inactivity
    const timer = setTimeout(() => {
          sendTypingIndicator(activeChat._chatId, false);
        }, 3000);
    
    return () => clearTimeout(timer);
      } else if (currentMessage.trim().length === 0) {
        // Send stopped typing indicator
        sendTypingIndicator(activeChat._chatId, false);
      }
    }
  }, [currentMessage, activeChat, wsConnected]);
  
  // Function to open relationship status dialog
  const openStatusDialog = (matchId) => {
    // Find the match object from the mutual crushes array
    const matchObject = mutualCrushes.find(match => match.id === matchId);
    
    if (matchObject) {
      console.log('Opening status dialog for match:', matchObject);
      // Set the active chat to the found match
      setActiveChat(matchObject);
      // Open the status dialog
      onStatusOpen();
    } else {
      console.error('Could not find match with ID:', matchId);
      showToast({
        title: 'Error',
        description: 'Could not find match information',
        status: 'error'
      });
    }
  };
  
  // Update the updateRelationshipStatus function to use WebSockets for system messages
  const updateRelationshipStatus = async (status) => {
    if (!activeChat) {
      console.error('No active chat when trying to update relationship status');
      return;
    }
    
    console.log('Updating relationship status to:', status, 'for chat:', activeChat);
    
    // Set loading state
    setIsUpdatingStatus(true);
    
    try {
      // Show loading toast
      showToast({
        title: "Updating Status",
        description: "Saving your new relationship status...",
        status: "info",
        duration: 2000
      });
      
      // Check if we have the chatId
      const chatId = activeChat._chatId;
      if (!chatId) {
        console.log('No chat ID found, retrieving it first');
        const chatResponse = await createPrivateChat({
          wall_id: wallId,
          target_user_id: activeChat.user.id
        });
        
        if (!chatResponse.success) {
          console.error('Failed to access chat:', chatResponse);
          showToast({
            title: 'Status Update Error',
            description: 'Failed to access chat: ' + (chatResponse.data?.message || 'Unknown error'),
            status: 'error'
          });
          setIsUpdatingStatus(false);
          return;
        }
        
        // Store the chat ID for future use
        activeChat._chatId = chatResponse.data.chat_id;
        console.log('Retrieved chat ID:', chatResponse.data.chat_id);
      }
      
      // Update relationship status in the database via API
      const updateResponse = await apiUpdateRelationshipStatus({
        wall_id: wallId,
        chat_id: activeChat._chatId,
        status: status
      });
      
      if (!updateResponse.success) {
        console.error('Failed to update relationship status in database:', updateResponse);
        showToast({
          title: 'Status Update Error',
          description: 'Failed to save status to database: ' + (updateResponse.data?.message || 'Unknown error'),
          status: 'error'
        });
        setIsUpdatingStatus(false);
        return;
      }
      
      console.log('Successfully updated relationship status in database:', updateResponse);
      
      // Update the status in the local state
      setRelationships(prev => {
        const updated = {
          ...prev,
          [activeChat.id]: {
            ...prev[activeChat.id],
            status,
            lastUpdated: new Date().toISOString()
          }
        };
        console.log('Updated relationships state:', updated);
        return updated;
      });
    
      // Add a system message in the chat
      const newMessage = {
        id: `system-${Date.now()}`,
        sender: 'system',
        text: `Relationship status updated to: ${status}`,
        timestamp: new Date().toISOString()
      };
    
      setPrivateMessages(prev => {
        const updated = {
          ...prev,
          [activeChat.id]: [...(prev[activeChat.id] || []), newMessage]
        };
        console.log('Updated private messages with system message');
        return updated;
      });
      
      // After updating local state, try to send system message via WebSocket
      let wsSuccess = false;
      if (wsConnected && activeChat?._chatId) {
        const systemMessage = `Relationship status updated to: ${status}`;
        console.log('Attempting to send status update via WebSocket');
        wsSuccess = wsSendChatMessage(
          activeChat._chatId,
          systemMessage,
          true
        );
      }
      
      // Save the relationship status to localStorage as a backup
      try {
        const relationshipsData = JSON.parse(localStorage.getItem('winkTrapRelationships') || '{}');
        relationshipsData[activeChat.id] = {
          status,
          lastUpdated: new Date().toISOString(),
          userId: activeChat.user.id,
          userName: activeChat.user.name
        };
        localStorage.setItem('winkTrapRelationships', JSON.stringify(relationshipsData));
        console.log('Saved relationship status to localStorage');
      } catch (e) {
        console.error('Error saving relationship to localStorage:', e);
      }
    
      // Close the dialog
      onStatusClose();
    
      // Show success toast
      showToast({
        title: "Status Updated",
        description: `Your relationship status with ${activeChat.user.name} has been updated to "${status}"`,
        status: "success"
      });
    } catch (error) {
      console.error('Error updating relationship status:', error);
      
      showToast({
        title: "Status Update Failed",
        description: "Could not update your relationship status. Please try again.",
        status: "error"
      });
    } finally {
      // Reset loading state
      setIsUpdatingStatus(false);
    }
  };
  
  // Remove crush function - uses the API to verify 4-hour waiting period
  const handleRemoveCrush = async () => {
    // Find current user's crush data
    const currentUserData = wallMembers.find(member => member.id === currentUser.id);
    
    if (!currentUserData || currentUserData.hasCrushOn === null) {
      return;
    }
    
    try {
      // Check if forcing bypass using URL parameter
      const forceBypass = window.location.search.includes('bypass_time=true');
      
      // Call the real API to remove the crush
      const response = await removeCrush({
        wall_id: wallId,
        test_mode: forceBypass
      });
      
      if (response.success) {
        // Update the local wall members state
    const updatedMembers = wallMembers.map(member => {
      // Reset current user's crush
      if (member.id === currentUser.id) {
        return {
          ...member,
          hasCrushOn: null,
          crushSetTime: null
        };
      }
      
      // Decrement the crush count of the previous target
      if (member.id === currentUserData.hasCrushOn) {
        return {
          ...member,
          crushCount: Math.max(0, member.crushCount - 1)
        };
      }
      
      return member;
    });
    
    setWallMembers(updatedMembers);
    
    // Check if this was a mutual crush and delete it from the list
    const matchId = `match-${currentUser.id}-${currentUserData.hasCrushOn}`;
    const matchExists = mutualCrushes.some(match => match.id === matchId);
    
    if (matchExists) {
      // Delete the match
      setMutualCrushes([]);
      
      // Clear chat history
      setPrivateMessages(prev => {
        const newMessages = {...prev};
        delete newMessages[matchId];
        return newMessages;
      });
      
      // Clear relationship status
      setRelationships(prev => {
        const newRelationships = {...prev};
        delete newRelationships[matchId];
        return newRelationships;
      });
      
      // Clear unread messages
      setUnreadMessages(prev => {
        const newUnread = {...prev};
        delete newUnread[matchId];
        return newUnread;
      });
      
      showToast({
        title: "Crush and Chat Removed",
        description: "Your crush has been removed and chat history has been deleted.",
        status: "info"
      });
    } else {
      showToast({
        title: "Crush removed",
        description: "You are no longer crushing on anyone in this wall.",
        status: "info"
      });
    }
    
    // If the chat is open, close it
    if (isPrivateChatOpen) {
      onPrivateChatClose();
    }
    
    // Reset active chat
    setActiveChat(null);
      } else {
        // Handle specific error case for 4-hour waiting period
        if (response.data?.timeRemaining) {
          // Extract time remaining information
          const hours = response.data.timeRemaining.hours;
          const minutes = response.data.timeRemaining.minutes;
          
          let timeMessage = '';
          if (hours > 0) {
            timeMessage = `${hours} hour${hours !== 1 ? 's' : ''}`;
            if (minutes > 0) {
              timeMessage += ` and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
          } else {
            timeMessage = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
          }
          
          // Format timestamp for user display
          const crushSetAt = response.data.crushSetTime ? new Date(response.data.crushSetTime).toLocaleString() : 'unknown time';
          const removableAt = response.data.removableAt ? new Date(response.data.removableAt).toLocaleString() : 'unknown time';
          
          showToast({
            title: "Cannot Remove Crush Yet",
            description: `Crush set at ${crushSetAt}. You can remove it at ${removableAt}. Please wait ${timeMessage} more.`,
            status: "warning"
          });
          
          // Add time info to console for debugging
          console.log('Crush removal time info:', {
            crushSetAt: response.data.crushSetTime,
            removableAt: response.data.removableAt,
            currentTime: response.data.currentTime,
            timeRemaining: response.data.timeRemaining
          });
        } else {
          showToast({
            title: "Failed to remove crush",
            description: response.data?.message || "An unknown error occurred",
            status: "error"
          });
        }
      }
    } catch (error) {
      console.error('Error removing crush:', error);
      
      showToast({
        title: "Connection error",
        description: "Could not connect to the server. Please try again later.",
        status: "error"
      });
    }
  };
  
  // Function to dismiss anniversary reminder
  const dismissAnniversary = () => {
    setShowAnniversaryReminder(false);
    setAnniversaryData(null);
  };
  
  // Function to celebrate anniversary in chat
  const celebrateAnniversary = async () => {
    if (!anniversaryData) return;
    
    const match = mutualCrushes.find(m => m.id === anniversaryData.matchId);
    if (!match) return;
    
    try {
      // Get the real chat_id from the match_id
      const chatResponse = await createPrivateChat({
        wall_id: wallId,
        target_user_id: match.user.id
      });
      
      if (!chatResponse.success) {
        showToast({
          title: 'Anniversary Error',
          description: 'Failed to access chat: ' + (chatResponse.data?.message || 'Unknown error'),
          status: 'error'
        });
        return;
      }
      
      const chatId = chatResponse.data.chat_id;
      
      // Create celebration message text
      const celebrationText = `🎉 Congratulations on your ${anniversaryData.days}-day anniversary! 🎉`;
      
      // Add a temporary celebration message in the chat for immediate display
      const tempMessage = {
        id: `system-temp-${Date.now()}`,
      sender: 'system',
        text: celebrationText,
      timestamp: new Date().toISOString()
    };
    
      // Update local UI state
    setPrivateMessages(prev => ({
      ...prev,
        [anniversaryData.matchId]: [...(prev[anniversaryData.matchId] || []), tempMessage]
      }));
      
      // Send message to the server (as a system message)
      // Using our existing sendChatMessage function
      const messageResponse = await sendChatMessage({
        wall_id: wallId,
        chat_id: chatId,
        message: celebrationText,
        is_system_message: true
      });
      
      if (!messageResponse.success) {
        console.error('Failed to save anniversary message:', messageResponse);
      }
    
    // Open the chat to show the celebration
    setActiveChat(match);
    onPrivateChatOpen();
    
    // Dismiss the reminder
    setShowAnniversaryReminder(false);
    setAnniversaryData(null);
    } catch (error) {
      console.error('Error celebrating anniversary:', error);
      
      showToast({
        title: 'Anniversary Error',
        description: 'Failed to send anniversary message: ' + error.message,
        status: 'error'
      });
    }
  };

  // Effect to update time remaining and remove expired posts
  useEffect(() => {
    // Set interval to update time remaining displays
    const interval = setInterval(() => {
      // Check if any posts have expired and filter them out
      const now = new Date();
      const updatedConfessions = confessions.filter(confession => {
        return new Date(confession.expiresAt) > now;
      });
      
      // If any posts were removed, update the state
      if (updatedConfessions.length < confessions.length) {
        setConfessions(updatedConfessions);
        
        // Show toast only if posts were actually removed
        if (confessions.length > 0 && updatedConfessions.length < confessions.length) {
          showToast({
            title: 'Posts expired',
            description: 'Some confessions have reached their 24-hour limit and were removed',
            status: 'info'
          });
        }
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [confessions]);
  
  // Check if user has no crushes set, and show a hint
  useEffect(() => {
    if (currentUser && wallMembers.length > 0) {
      const currentUserData = wallMembers.find(m => m.id === currentUser.id);
      
      // If user has no crush set and hasn't seen the hint yet, show it
      if (currentUserData && !currentUserData.hasCrushOn && !localStorage.getItem('crushHintShown')) {
        // Wait a bit to show the hint after page load
        setTimeout(() => {
          showToast({
            title: "Set Your First Crush",
            description: "Go to the 'Members' tab and set a crush to start making connections!",
            status: "info",
            duration: 6000
          });
          
          // Mark hint as shown
          localStorage.setItem('crushHintShown', 'true');
        }, 5000);
      }
    }
  }, [currentUser, wallMembers]);
  
  // Load relationship statuses from localStorage on mount
  useEffect(() => {
    try {
      const storedRelationships = localStorage.getItem('winkTrapRelationships');
      if (storedRelationships) {
        const relationshipsData = JSON.parse(storedRelationships);
        
        // Only set relationships for mutual crushes that exist in the current session
        if (mutualCrushes.length > 0 && relationshipsData) {
          const updatedRelationships = {};
          
          // For each mutual crush, check if we have stored relationship data
          mutualCrushes.forEach(match => {
            if (relationshipsData[match.id]) {
              updatedRelationships[match.id] = {
                status: relationshipsData[match.id].status,
                lastUpdated: relationshipsData[match.id].lastUpdated,
                anniversaryChecked: false
              };
            }
          });
          
          // Update the relationships state if we have any data
          if (Object.keys(updatedRelationships).length > 0) {
            console.log('Loaded relationship statuses from localStorage:', updatedRelationships);
            setRelationships(prev => ({
              ...prev,
              ...updatedRelationships
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading relationship statuses from localStorage:', error);
    }
  }, [mutualCrushes]);
  
  // Add WebSocket connection status indicator to UI
  const renderConnectionStatus = () => {
    if (wsConnected) {
      return (
        <Badge colorScheme="green" variant="subtle" fontSize="xs">
          <HStack spacing={1}>
            <Box w="8px" h="8px" borderRadius="full" bg="green.500" />
            <Text>Live</Text>
          </HStack>
        </Badge>
      );
    } else if (wsStatus === CONNECTION_STATUS.CONNECTING) {
      return (
        <Badge colorScheme="yellow" variant="subtle" fontSize="xs">
          <HStack spacing={1}>
            <Box w="8px" h="8px" borderRadius="full" bg="yellow.500" animation="pulse 1s infinite" />
            <Text>Connecting</Text>
          </HStack>
        </Badge>
      );
    } else {
      return (
        <Badge colorScheme="red" variant="subtle" fontSize="xs">
          <HStack spacing={1}>
            <Box w="8px" h="8px" borderRadius="full" bg="red.500" />
            <Text>Offline</Text>
          </HStack>
        </Badge>
      );
    }
  };
  
  // Initialize relationships data on mutual crush updates
  useEffect(() => {
    // For each mutual crush, ensure we have relationship data
    mutualCrushes.forEach(match => {
      if (!relationships[match.id]) {
        setRelationships(prev => ({
          ...prev,
          [match.id]: {
            status: "Just matched",
            lastUpdated: new Date().toISOString(),
            anniversaryChecked: false
          }
        }));
      }
      
      // Check for relationship milestones/anniversaries
      const matchDate = new Date(match.matchTime);
      const today = new Date();
      const daysSinceMatch = Math.floor((today - matchDate) / (1000 * 60 * 60 * 24));
      
      // Check for 7-day, 30-day, 90-day, 180-day, or 365-day anniversary
      const isAnniversary = [7, 30, 90, 180, 365].includes(daysSinceMatch);
      
      if (isAnniversary && !relationships[match.id]?.anniversaryChecked) {
        setAnniversaryData({
          matchId: match.id,
          userName: match.user.name,
          userAvatar: match.user.avatar,
          days: daysSinceMatch
        });
        
        setShowAnniversaryReminder(true);
        
        // Mark this anniversary as checked
        setRelationships(prev => ({
          ...prev,
          [match.id]: {
            ...prev[match.id],
            anniversaryChecked: true
          }
        }));
      }
    });
    
    // Unlock chats tab if there are any mutual crushes
    if (mutualCrushes.length > 0) {
      setIsChatsTabLocked(false);
    } else {
      setIsChatsTabLocked(true);
      // If we're on the chats tab but no longer have any mutual crushes, switch to confessions tab
      if (tabIndex === 2) {
        setTabIndex(0);
      }
    }
  }, [mutualCrushes, tabIndex]);

  return (
    <Box bg={bgColor} minH="100vh" py={4}>
      <Container maxW="container.md" px={{ base: 2, sm: 4, md: 6 }}>
        <VStack spacing={{ base: 4, md: 8 }} align="stretch">
          {/* Header */}
          <Flex 
            align="center" 
            flexDirection={{ base: "column", sm: "row" }}
            gap={{ base: 2, sm: 0 }}
          >
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
              alignSelf={{ base: "flex-start", sm: "center" }}
              mb={{ base: 2, sm: 0 }}
            >
              Back to Home
            </Button>
            <Spacer />
            <Box /> {/* Empty spacer to balance the layout */}
          </Flex>
          
          {/* Wall Info Card */}
          <Card bg={cardBg} rounded="xl" overflow="hidden" boxShadow="dark-lg" borderColor="dark.700" borderWidth="1px">
            <Box position="relative" h={{ base: "150px", md: "200px" }}>
              {isLoading ? (
                <Flex h="100%" w="100%" bg="dark.700" justify="center" align="center">
                  <Text color="gray.400">Loading wall data...</Text>
                </Flex>
              ) : (
                <>
              <Box 
                as="img" 
                    src={currentWall.image || 'https://images.unsplash.com/photo-1522441815192-d9f04eb0615c'} 
                alt={currentWall.name}
                objectFit="cover"
                w="100%"
                h="100%"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1522441815192-d9f04eb0615c';
                    }}
              />
              <Box 
                position="absolute" 
                bottom={0} 
                left={0} 
                right={0} 
                p={4}
                bg="linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))"
              >
                <Heading as="h2" size={{ base: "sm", md: "md" }} color="white">
                  {currentWall.name}
                </Heading>
                <HStack mt={1} flexWrap="wrap">
                  <Badge colorScheme="purple" rounded="full" px={2} py={1} fontSize={{ base: "xs", md: "sm" }}>
                    {currentWall.members} members
                  </Badge>
                  <Text color="gray.300" fontSize={{ base: "xs", md: "sm" }}>
                    Created on {new Date(currentWall.created_at).toLocaleDateString()}
                  </Text>
                </HStack>
              </Box>
                </>
              )}
            </Box>
            <CardBody pt={3} pb={4}>
              {isLoading ? (
                <Text color="gray.400">Loading description...</Text>
              ) : (
              <Text color="gray.300" fontSize={{ base: "sm", md: "md" }}>{currentWall.description}</Text>
              )}
            </CardBody>
          </Card>
          
          {/* Mutual Crush Alerts - If any exist */}
          {mutualCrushes && mutualCrushes.length > 0 && (
            <Card 
              bg="pink.900" 
              rounded="xl" 
              overflow="hidden" 
              boxShadow="dark-lg" 
              borderColor="pink.700" 
              borderWidth="1px"
              position="relative"
              zIndex="2"
              mt={4}
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
              }}
              transition="all 0.3s"
              className="mutual-crush-card"
              sx={{
                '@keyframes pulse': {
                  '0%': { 
                    boxShadow: '0 0 0 0 rgba(237, 100, 166, 0.7)',
                  },
                  '70%': { 
                    boxShadow: '0 0 0 10px rgba(237, 100, 166, 0)',
                  },
                  '100%': { 
                    boxShadow: '0 0 0 0 rgba(237, 100, 166, 0)',
                  },
                },
                animation: 'pulse 2s infinite',
              }}
            >
              <Box 
                position="absolute" 
                top="-10px" 
                right="-10px" 
                bg="red.500" 
                rounded="full" 
                p={1}
                boxShadow="lg"
                zIndex="3"
                className="heartbeat-icon"
                sx={{
                  '@keyframes heartbeat': {
                    '0%': { transform: 'scale(1)' },
                    '25%': { transform: 'scale(1.1)' },
                    '50%': { transform: 'scale(1)' },
                    '75%': { transform: 'scale(1.1)' },
                    '100%': { transform: 'scale(1)' },
                  },
                  animation: 'heartbeat 1s infinite',
                }}
              >
                <Box as="span" fontSize="xl">💕</Box>
              </Box>
              <CardBody py={4}>
                <VStack spacing={4} align="stretch">
                  <Heading size={{ base: "xs", sm: "sm" }} color="white">
                    Mutual Crushes - You've Got {mutualCrushes.length} Match{mutualCrushes.length > 1 ? 'es' : ''}!
                    <IconButton
                      aria-label="Refresh mutual crushes"
                      icon={<Box as="span" fontSize="1em">🔄</Box>}
                      size="xs"
                      variant="ghost"
                      colorScheme="white"
                      ml={2}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Manually refreshing mutual crushes');
                        checkForMutualCrushes();
                        showToast({
                          title: "Refreshed",
                          description: "Checked for new mutual crushes",
                          status: "info"
                        });
                      }}
                    />
                  </Heading>
                  
                  <Divider borderColor="pink.700" />
                  
                  {mutualCrushes.map(match => (
                    <HStack key={match.id} spacing={{ base: 2, md: 4 }} flexWrap={{ base: "wrap", md: "nowrap" }}>
                      <Popover trigger="hover" placement="right">
                        <PopoverTrigger>
                          <Avatar 
                            name={match.user.name} 
                            src={match.user.avatar} 
                            size={{ base: "sm", md: "md" }} 
                            cursor="pointer" 
                          />
                        </PopoverTrigger>
                        <PopoverContent bg="dark.800" borderColor="dark.600">
                          <PopoverArrow bg="dark.800" />
                          <PopoverBody p={4}>
                            <VStack align="start" spacing={2}>
                              <Text color="white" fontWeight="bold">{match.user.name}</Text>
                              <Text color="gray.300" fontSize="sm">
                                Matched on {new Date(match.matchTime).toLocaleDateString()}
                              </Text>
                              <Badge colorScheme="pink" mt={1}>
                                {relationships[match.id]?.status || "Just matched"}
                              </Badge>
                            </VStack>
                          </PopoverBody>
                        </PopoverContent>
                      </Popover>
                      <Box flex="1" minW={{ base: "0", md: "auto" }}>
                        <Text fontWeight="bold" color="white" fontSize={{ base: "sm", md: "md" }}>
                          {match.user.name}
                          {typingIndicators[match.id] && (
                            <Badge ml={2} colorScheme="green" variant="solid" fontSize="xs">
                              typing...
                            </Badge>
                          )}
                        </Text>
                        <HStack spacing={2} flexWrap="wrap">
                          <Badge colorScheme="purple" rounded="full" px={2} fontSize="xs">
                            {relationships[match.id]?.status || "Just matched"}
                          </Badge>
                          <Text color="pink.200" fontSize="xs">
                            since {new Date(match.matchTime).toLocaleDateString()}
                          </Text>
                        </HStack>
                      </Box>
                      <HStack spacing={1} ml={{ base: "auto", md: 0 }} mt={{ base: 2, sm: 0 }} w={{ base: "100%", sm: "auto" }} justifyContent={{ base: "flex-end", sm: "flex-end" }}>
                        <IconButton
                          aria-label="Update relationship status"
                          icon={<Box as="span" fontSize="1.2em">⚡</Box>}
                          variant="ghost"
                          colorScheme="purple"
                          onClick={() => openStatusDialog(match.id)}
                          size="sm"
                        />
                        <Button 
                          colorScheme="pink" 
                          variant="solid" 
                          size="sm"
                          leftIcon={<Box as="span" fontSize="1.2em">💬</Box>}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent event bubbling
                            handleOpenChat(match);
                          }}
                          position="relative"
                          _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                          transition="all 0.2s"
                          fontWeight="bold"
                        >
                          Chat
                          {unreadMessages[match.id] > 0 && (
                            <Badge 
                              position="absolute" 
                              top="-8px" 
                              right="-8px" 
                              borderRadius="full" 
                              bg="red.500" 
                              color="white"
                              px={2}
                              boxShadow="0 0 0 2px #1A202C"
                            >
                              {unreadMessages[match.id]}
                            </Badge>
                          )}
                        </Button>
                      </HStack>
                    </HStack>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          )}
          
          {/* Tabs for Confessions, Members, and Chats */}
          <Tabs 
            variant="soft-rounded" 
            colorScheme="brand" 
            index={tabIndex} 
            onChange={(index) => {
              // If trying to access locked chats tab, show toast message
              if (index === 2 && isChatsTabLocked) {
                showToast({
                  title: "Chats Locked",
                  description: "Create a mutual crush connection to unlock private chats!",
                  status: "warning"
                });
                return;
              }
              
              // If switching to the chats tab, refresh mutual crushes
              if (index === 2) {
                console.log('Switched to Chats tab - refreshing member data and mutual crushes');
                refreshMemberData();
              }
              
              // If switching to the Members tab, refresh member data and mutual crushes
              if (index === 1) {
                console.log('Switched to Members tab - refreshing member data and mutual crushes');
                refreshMemberData();
              }
              
              setTabIndex(index);
            }}
            bg={cardBg}
            rounded="xl"
            p={{ base: 2, sm: 4 }}
            boxShadow="dark-lg"
          >
            <TabList mb={4} overflowX="auto" flexWrap={{ base: "nowrap", md: "wrap" }} css={{ scrollbarWidth: 'none', '::-webkit-scrollbar': { display: 'none' } }}>
              <Tab 
                _selected={{ 
                  color: 'white', 
                  bg: 'brand.500' 
                }}
                color="gray.300"
                minW={{ base: "auto", md: "120px" }}
                fontSize={{ base: "sm", md: "md" }}
                py={{ base: 1, md: 2 }}
                flexShrink={0}
              >
                Confessions
              </Tab>
              <Tab 
                _selected={{ 
                  color: 'white', 
                  bg: 'brand.500' 
                }}
                color="gray.300"
                minW={{ base: "auto", md: "120px" }}
                fontSize={{ base: "sm", md: "md" }}
                py={{ base: 1, md: 2 }}
                flexShrink={0}
              >
                Members ({wallMembers.length})
              </Tab>
              <Tab 
                _selected={{ 
                  color: 'white', 
                  bg: 'brand.500' 
                }}
                color="gray.300"
                isDisabled={isChatsTabLocked}
                opacity={isChatsTabLocked ? 0.6 : 1}
                position="relative"
                minW={{ base: "auto", md: "120px" }}
                fontSize={{ base: "sm", md: "md" }}
                py={{ base: 1, md: 2 }}
                flexShrink={0}
              >
                {!isChatsTabLocked && mutualCrushes.length > 0 ? (
                  <HStack spacing={1}>
                    <Text>Chats</Text>
                    <Badge 
                      colorScheme="pink" 
                      rounded="full" 
                      px={2}
                      fontSize="xs"
                      ml={1}
                    >
                      {mutualCrushes.length}
                    </Badge>
                  </HStack>
                ) : (
                  <Text>Chats</Text>
                )}
                {isChatsTabLocked && (
                  <Box 
                    position="absolute" 
                    right="-6px" 
                    top="-6px" 
                    fontSize="lg" 
                    color="gray.500"
                  >
                    🔒
                  </Box>
                )}
                {/* Show notification count on tab if there are unread messages */}
                {!isChatsTabLocked && Object.values(unreadMessages).reduce((a, b) => a + b, 0) > 0 && (
                  <Badge 
                    ml={2} 
                    colorScheme="red" 
                    borderRadius="full" 
                    fontSize="xs"
                  >
                    {Object.values(unreadMessages).reduce((a, b) => a + b, 0)}
                  </Badge>
                )}
              </Tab>
            </TabList>
            
            <TabPanels>
              {/* Confessions Panel */}
              <TabPanel p={{ base: 0, sm: 2 }}>
                {/* New Confession Button */}
                <Button
                  colorScheme="brand"
                  size={{ base: "md", md: "lg" }}
                  width="full"
                  rounded="full"
                  bgGradient={brandGradient}
                  _hover={{
                    bg: 'brand.400'
                  }}
                  leftIcon={<Box as="span" fontSize="1.2em">❤️</Box>}
                  onClick={onOpen}
                  mb={6}
                >
                  Post Secret Crush Confession
                </Button>
                
                {/* Confessions List */}
                <VStack spacing={6} align="stretch">
                  {confessions.map(confession => (
                    <Card 
                      key={confession.id} 
                      bg={cardBg} 
                      rounded="xl" 
                      overflow="hidden" 
                      boxShadow="dark-lg" 
                      borderColor="dark.700" 
                      borderWidth="1px"
                    >
                      <CardBody pt={4} pb={3}>
                        <Text color={textColor} fontSize={{ base: "sm", md: "md" }} mb={3}>
                          {confession.text}
                        </Text>
                        <Flex justifyContent="space-between" alignItems="center" flexWrap={{ base: "wrap", sm: "nowrap" }}>
                          <HStack spacing={2} flexWrap="wrap">
                            <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }}>
                              Anonymous • {formatDate(confession.timestamp)}
                            </Text>
                            {confession.expiresAt && (
                              <Badge colorScheme="red" fontSize="xs" variant="subtle" rounded="full" px={2}>
                                <HStack spacing={1}>
                                  <Box as="span" fontSize="0.8em">⏱️</Box>
                                  <Text>{getTimeRemaining(confession.expiresAt)}</Text>
                                </HStack>
                              </Badge>
                            )}
                          </HStack>
                          <HStack mt={{ base: 2, sm: 0 }} ml={{ base: "auto", sm: 0 }}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              leftIcon={<Box as="span" fontSize="1.2em">❤️</Box>}
                              color="gray.400"
                              _hover={{
                                color: 'red.300',
                                bg: 'dark.700'
                              }}
                              onClick={() => handleLike(confession.id)}
                              px={{ base: 2, sm: 3 }}
                            >
                              {confession.likes}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              leftIcon={<Box as="span" fontSize="1.2em">💬</Box>}
                              color="gray.400"
                              _hover={{
                                color: 'brand.300',
                                bg: 'dark.700'
                              }}
                              onClick={() => toggleComments(confession.id)}
                              px={{ base: 2, sm: 3 }}
                            >
                              {confession.comments.length}
                            </Button>
                          </HStack>
                        </Flex>
                      </CardBody>
                      
                      {/* Comments Section */}
                      {(expandedComments[confession.id] || confession.comments.length > 0) && (
                        <>
                          <Divider borderColor="dark.700" />
                          
                          <CardFooter flexDirection="column" py={3}>
                            {/* Comment List */}
                            {confession.comments.length > 0 && (
                              <VStack spacing={3} align="stretch" mb={confession.comments.length > 0 ? 4 : 0}>
                                {confession.comments.map(comment => (
                                  <Box key={comment.id}>
                                    <HStack align="start" spacing={2}>
                                      <Avatar size="sm" name={comment.userName} src={comment.userAvatar} />
                                      <Box flex="1">
                                        <Flex align="center" mb={1} flexWrap="wrap">
                                          <Text fontWeight="bold" color="gray.300" fontSize={{ base: "xs", sm: "sm" }}>
                                            {comment.userName}
                                          </Text>
                                          <Text color="gray.500" fontSize="xs" ml={2}>
                                            {formatDate(comment.timestamp)}
                                          </Text>
                                        </Flex>
                                        <Text color={textColor} fontSize={{ base: "xs", sm: "sm" }} mb={1}>
                                          {comment.text}
                                        </Text>
                                        <HStack spacing={4}>
                                          <Button 
                                            variant="ghost" 
                                            size="xs" 
                                            leftIcon={<Box as="span" fontSize="1em">❤️</Box>}
                                            color="gray.500"
                                            _hover={{
                                              color: 'red.300',
                                              bg: 'transparent'
                                            }}
                                            onClick={() => handleCommentLike(confession.id, comment.id)}
                                            p={0}
                                          >
                                            {comment.likes}
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="xs" 
                                            color="gray.500"
                                            _hover={{
                                              color: 'brand.300',
                                              bg: 'transparent'
                                            }}
                                            onClick={() => toggleReplyForm(confession.id, comment.id)}
                                            p={0}
                                          >
                                            Reply
                                          </Button>
                                        </HStack>
                                        
                                        {/* Replies for this comment */}
                                        {comment.replies && comment.replies.length > 0 && (
                                          <VStack mt={2} spacing={2} align="stretch" pl={{ base: 2, sm: 4 }} borderLeftWidth="1px" borderColor="dark.700">
                                            {comment.replies.map(reply => (
                                              <HStack key={reply.id} align="start" spacing={2}>
                                                <Avatar size="xs" name={reply.userName} src={reply.userAvatar} />
                                                <Box flex="1">
                                                  <Flex align="center" mb={1} flexWrap="wrap">
                                                    <Text fontWeight="bold" color="gray.300" fontSize="xs">
                                                      {reply.userName}
                                                    </Text>
                                                    <Text color="gray.500" fontSize="xs" ml={2}>
                                                      {formatDate(reply.timestamp)}
                                                    </Text>
                                                  </Flex>
                                                  <Text color={textColor} fontSize="xs">
                                                    {reply.text}
                                                  </Text>
                                                </Box>
                                              </HStack>
                                            ))}
                                          </VStack>
                                        )}
                                        
                                        {/* Reply form */}
                                        {showReplyForms[`${confession.id}-${comment.id}`] && (
                                          <HStack mt={2} spacing={2}>
                                            <Avatar size="xs" name={currentUser?.name} src={currentUser?.avatar || 'https://i.pravatar.cc/150'} />
                                            <Input 
                                              placeholder="Write a reply..."
                                              size="sm"
                                              variant="filled"
                                              bg="dark.700"
                                              _hover={{ bg: 'dark.600' }}
                                              _focus={{ bg: 'dark.600', borderColor: 'brand.400' }}
                                              value={newReplies[`${confession.id}-${comment.id}`] || ''}
                                              onChange={(e) => setNewReplies({
                                                ...newReplies,
                                                [`${confession.id}-${comment.id}`]: e.target.value
                                              })}
                                              onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                  handleReplySubmit(confession.id, comment.id);
                                                }
                                              }}
                                            />
                                            <IconButton
                                              icon={<Box as="span" fontSize="1.2em">✍</Box>}
                                              aria-label="Send reply"
                                              colorScheme="brand"
                                              size="sm"
                                              onClick={() => handleReplySubmit(confession.id, comment.id)}
                                            />
                                          </HStack>
                                        )}
                                      </Box>
                                    </HStack>
                                  </Box>
                                ))}
                              </VStack>
                            )}
                            
                            {/* New Comment Form */}
                            <HStack spacing={2}>
                              <Avatar size="sm" name={currentUser?.name} src={currentUser?.avatar || 'https://i.pravatar.cc/150'} />
                              <Input 
                                placeholder="Write a comment..."
                                variant="filled"
                                bg="dark.700"
                                _hover={{ bg: 'dark.600' }}
                                _focus={{ bg: 'dark.600', borderColor: 'brand.400' }}
                                value={newComments[confession.id] || ''}
                                onChange={(e) => setNewComments({
                                  ...newComments,
                                  [confession.id]: e.target.value
                                })}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCommentSubmit(confession.id);
                                  }
                                }}
                                size={{ base: "sm", sm: "md" }}
                              />
                              <IconButton
                                icon={<Box as="span" fontSize="1.2em">✍</Box>}
                                aria-label="Send comment"
                                colorScheme="brand"
                                onClick={() => handleCommentSubmit(confession.id)}
                                size={{ base: "sm", sm: "md" }}
                              />
                            </HStack>
                          </CardFooter>
                        </>
                      )}
                    </Card>
                  ))}
                </VStack>
              </TabPanel>
              
              {/* Members Panel - Modified for mobile */}
              <TabPanel p={{ base: 0, sm: 2 }}>
                <VStack spacing={3} align="stretch">
                  <Box 
                    bg="purple.900" 
                    p={{ base: 2, sm: 3 }}
                    rounded="lg" 
                    mb={2}
                    borderLeftWidth="4px"
                    borderColor="purple.400"
                  >
                    <HStack justify="space-between" align="center">
                    <Text fontSize={{ base: "xs", sm: "sm" }} color="gray.100">
                      Members in this wall. You can only have a crush on one person at a time.
                    </Text>
                      <Button 
                        size="xs" 
                        colorScheme="purple" 
                        onClick={() => refreshMemberData()}
                        title="Refresh member data and mutual crushes"
                      >
                        🔄 Refresh
                      </Button>
                    </HStack>
                  </Box>
                  
                  {wallMembers.map((member) => (
                    <Flex 
                      key={member.id} 
                      bg={cardBg} 
                      p={3}
                      rounded="lg" 
                      borderWidth="1px"
                      borderColor={member.id === currentUser.id ? "brand.600" : "dark.700"} 
                      align="center"
                      gap={3}
                      flexWrap={{ base: "wrap", md: "nowrap" }}
                    >
                      <Avatar 
                        size="md" 
                        name={member.name} 
                        src={member.avatar} 
                        border="2px solid"
                        borderColor={member.id === currentUser.id ? "brand.500" : "transparent"}
                      />
                      
                      <Box flex="1" minW={0}>
                        <Flex align="center" wrap="wrap" gap={2}>
                          <Text fontWeight="bold" color="white">
                            {member.name}
                          </Text>
                          
                          {member.id === currentUser.id && (
                            <Badge colorScheme="brand" variant="solid">
                              You
                            </Badge>
                          )}
                          
                          <Badge colorScheme="red" variant="subtle">
                            <HStack spacing={1}>
                              <Box as="span" fontSize="xs">❤️</Box>
                              <Text>{member.crushCount} {member.crushCount === 1 ? 'admirer' : 'admirers'}</Text>
                            </HStack>
                          </Badge>
                          
                          {/* Show "Mutual" badge if applicable */}
                          {member.id !== currentUser.id && 
                           member.hasCrushOn === currentUser.id && 
                           wallMembers.find(m => m.id === currentUser.id)?.hasCrushOn === member.id && (
                            <Badge colorScheme="pink" variant="subtle">
                              <HStack spacing={1}>
                                <Box as="span" fontSize="xs">💕</Box>
                                <Text>Mutual</Text>
                              </HStack>
                            </Badge>
                          )}
                        </Flex>
                        
                        {/* Current user's crush indicator */}
                        {member.id !== currentUser.id && 
                         currentUser.id && 
                         wallMembers.find(m => m.id === currentUser.id)?.hasCrushOn === member.id && (
                          <Text color="pink.300" fontSize="xs" mt={1}>
                            You have a crush on this person
                          </Text>
                        )}
                      </Box>
                      
                      {/* Action button for non-current users */}
                      {member.id !== currentUser.id && (
                        <Box ml={{ base: 0, md: "auto" }} w={{ base: "100%", md: "auto" }} mt={{ base: 2, md: 0 }}>
                          {wallMembers.find(m => m.id === currentUser.id)?.hasCrushOn === member.id ? (
                            <VStack spacing={1} align="stretch">
                              <Button
                                colorScheme="red"
                                variant="outline"
                                size="sm"
                                leftIcon={<Box as="span" fontSize="1em">💔</Box>}
                                onClick={handleRemoveCrush}
                                width={{ base: "100%", md: "auto" }}
                              >
                                Remove Crush
                              </Button>
                              
                              {/* Removing the time remaining display */}
                            </VStack>
                          ) : (
                            <Button
                              bg={crushButtonBg}
                              color="white"
                              _hover={{ bg: crushButtonHoverBg }}
                              size="sm"
                              leftIcon={<Box as="span" fontSize="1em">❤️</Box>}
                              onClick={() => handleSetCrush(member.id)}
                              width={{ base: "100%", md: "auto" }}
                            >
                              Set Crush
                            </Button>
                          )}
                        </Box>
                      )}
                    </Flex>
                  ))}
                </VStack>
              </TabPanel>
              
              {/* Private Chats Panel - Mobile friendly */}
              <TabPanel p={{ base: 0, sm: 2 }}>
                {!isChatsTabLocked ? (
                  <VStack spacing={3} align="stretch">
                    <Box 
                      bg="purple.900" 
                      p={{ base: 2, sm: 3 }}
                      rounded="lg" 
                      mb={2}
                      borderLeftWidth="4px"
                      borderColor="purple.400"
                    >
                      <HStack justify="space-between" align="center">
                      <Text fontSize={{ base: "xs", sm: "sm" }} color="gray.100">
                          Your private chats with mutual crushes will appear here.
                      </Text>
                        <Button 
                          size="xs" 
                          colorScheme="purple" 
                          onClick={() => refreshMemberData()}
                          title="Refresh member data and mutual crushes"
                          mr={1}
                        >
                          🔄 Refresh
                        </Button>
                        
                        <Button
                          size="xs"
                          colorScheme="red"
                          onClick={() => {
                            const currentUserData = wallMembers.find(m => m.id === currentUser.id);
                            const crushTarget = currentUserData?.hasCrushOn 
                              ? wallMembers.find(m => m.id === currentUserData.hasCrushOn)
                              : null;
                              
                            const debugInfo = {
                              user: {
                                id: currentUser.id,
                                name: currentUser.name,
                                hasCrushOn: currentUserData?.hasCrushOn
                              },
                              target: crushTarget ? {
                                id: crushTarget.id,
                                name: crushTarget.name,
                                hasCrushOn: crushTarget.hasCrushOn
                              } : 'No crush set',
                              isMutual: crushTarget && crushTarget.hasCrushOn === currentUser.id
                            };
                            
                            console.log('Crush Debug Info:', debugInfo);
                            
                            if (crushTarget) {
                              showToast({
                                title: 'Crush Debug Info',
                                description: `You have crush on: ${crushTarget.name} | ${debugInfo.isMutual ? 'MUTUAL!' : 'Not mutual (click again to force-create chat)'} `,
                                status: 'info',
                                duration: 5000
                              });
                              
                              // If not mutual, allow a second click to force-create a chat in dev mode
                              if (!debugInfo.isMutual) {
                                const forceBtn = document.createElement('button');
                                forceBtn.innerHTML = 'Force Create Chat';
                                forceBtn.style.padding = '5px 10px';
                                forceBtn.style.margin = '5px 0';
                                forceBtn.style.backgroundColor = '#e53e3e';
                                forceBtn.style.color = 'white';
                                forceBtn.style.border = 'none';
                                forceBtn.style.borderRadius = '5px';
                                forceBtn.style.cursor = 'pointer';
                                
                                forceBtn.onclick = async () => {
                                  try {
                                    const response = await createPrivateChat({
                                      wall_id: wallId,
                                      target_user_id: crushTarget.id,
                                      dev_mode: true // Enable dev mode to bypass mutual crush check
                                    });
                                    
                                    if (response.success) {
                                      // Create a manual match object
                                      const matchId = `match-${Math.min(currentUser.id, crushTarget.id)}-${Math.max(currentUser.id, crushTarget.id)}`;
                                      const match = {
                                        id: matchId,
                                        user: crushTarget,
                                        matchTime: new Date().toISOString()
                                      };
                                      
                                      // Add to mutual crushes
                                      setMutualCrushes(prev => [...prev, match]);
                                      
                                      // Unlock chats tab
                                      setIsChatsTabLocked(false);
                                      
                                      showToast({
                                        title: 'Dev Chat Created',
                                        description: `Created chat with ${crushTarget.name} in dev mode!`,
                                        status: 'success'
                                      });
                                      
                                      // Open the chat
                                      setTimeout(() => handleOpenChat(match), 500);
                                    } else {
                                      showToast({
                                        title: 'Error Creating Dev Chat',
                                        description: response.data?.message || 'Unknown error',
                                        status: 'error'
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Error forcing chat creation:', error);
                                  }
                                };
                                
                                // Show popup with force button
                                const popup = document.createElement('div');
                                popup.style.position = 'fixed';
                                popup.style.top = '50%';
                                popup.style.left = '50%';
                                popup.style.transform = 'translate(-50%, -50%)';
                                popup.style.backgroundColor = '#2D3748';
                                popup.style.padding = '15px';
                                popup.style.borderRadius = '8px';
                                popup.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                                popup.style.zIndex = '1000';
                                popup.style.display = 'flex';
                                popup.style.flexDirection = 'column';
                                
                                const text = document.createElement('p');
                                text.innerHTML = `Create test chat with ${crushTarget.name}?`;
                                text.style.color = 'white';
                                text.style.marginBottom = '10px';
                                
                                const buttonContainer = document.createElement('div');
                                buttonContainer.style.display = 'flex';
                                buttonContainer.style.justifyContent = 'space-between';
                                
                                const cancelBtn = document.createElement('button');
                                cancelBtn.innerHTML = 'Cancel';
                                cancelBtn.style.padding = '5px 10px';
                                cancelBtn.style.backgroundColor = '#4A5568';
                                cancelBtn.style.color = 'white';
                                cancelBtn.style.border = 'none';
                                cancelBtn.style.borderRadius = '5px';
                                cancelBtn.style.cursor = 'pointer';
                                cancelBtn.onclick = () => document.body.removeChild(popup);
                                
                                buttonContainer.appendChild(cancelBtn);
                                buttonContainer.appendChild(forceBtn);
                                
                                popup.appendChild(text);
                                popup.appendChild(buttonContainer);
                                
                                document.body.appendChild(popup);
                              }
                            } else {
                              showToast({
                                title: 'Crush Debug Info',
                                description: 'You don\'t have a crush on anyone yet',
                                status: 'info'
                              });
                            }
                          }}
                          title="Debug crush status"
                        >
                          🔍 Debug
                        </Button>
                      </HStack>
                    </Box>
                    
                    {mutualCrushes.length === 0 ? (
                      <Box 
                        bg="dark.800" 
                        p={4} 
                        rounded="lg" 
                        textAlign="center" 
                        borderWidth="1px" 
                        borderColor="dark.700"
                      >
                        <Text color="gray.400">No mutual crushes yet. When you and someone else both have crushes on each other, you'll see them here.</Text>
                      </Box>
                    ) : (
                      // Map through mutual crushes to display chat cards
                      mutualCrushes.map(match => (
                      <Card 
                        key={match.id} 
                        bg={cardBg} 
                          _hover={{ 
                            bg: 'dark.700', 
                            transform: 'translateY(-2px)',
                            boxShadow: 'lg'
                          }}
                        onClick={() => handleOpenChat(match)}
                        cursor="pointer"
                          borderWidth="1px"
                          borderColor="pink.900"
                          overflow="hidden"
                          position="relative"
                        transition="all 0.2s"
                          _before={{
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            bg: 'pink.500',
                            borderRadius: '4px 0 0 4px'
                          }}
                      >
                        <CardBody py={{ base: 3, sm: 4 }}>
                          <Flex align="center" flexWrap={{ base: "wrap", sm: "nowrap" }}>
                              <Avatar 
                                name={match.user.name} 
                                src={match.user.avatar} 
                                size={{ base: "sm", sm: "md" }}
                                bg="pink.500"
                                borderWidth="2px"
                                borderColor="pink.300"
                              />
                            <Box ml={{ base: 2, sm: 4 }} flex="1" minW={0}>
                              <Flex alignItems="center" flexWrap="wrap">
                                <Text fontWeight="bold" color="white" fontSize={{ base: "sm", sm: "md" }}>
                                  {match.user.name}
                                </Text>
                                {typingIndicators[match.id] && (
                                  <Badge ml={2} colorScheme="green" variant="solid" fontSize="xs">
                                    typing...
                                  </Badge>
                                )}
                              </Flex>
                              <HStack spacing={2} flexWrap="wrap" mt={{ base: 0.5, sm: 0 }}>
                                  <Badge colorScheme="pink" fontSize="xs" px={2} py={0.5}>
                                    {relationships[match.id]?.status || "Mutual Crush 💕"} 
                                </Badge>
                                
                                {/* Preview of last message if exists */}
                                {privateMessages[match.id] && privateMessages[match.id].length > 0 && (
                                  <Text color="gray.400" fontSize="xs" noOfLines={1} maxW={{ base: "150px", sm: "200px", md: "300px" }}>
                                    {privateMessages[match.id][privateMessages[match.id].length - 1].sender === 'system' 
                                      ? privateMessages[match.id][privateMessages[match.id].length - 1].text
                                      : privateMessages[match.id][privateMessages[match.id].length - 1].sender === currentUser.id
                                        ? `You: ${privateMessages[match.id][privateMessages[match.id].length - 1].text}`
                                        : privateMessages[match.id][privateMessages[match.id].length - 1].text
                                    }
                                  </Text>
                                )}
                              </HStack>
                            </Box>
                            <HStack ml={{ base: "auto", sm: 0 }} mt={{ base: 1, sm: 0 }}>
                              {/* Show message timestamp */}
                              {privateMessages[match.id] && privateMessages[match.id].length > 0 && (
                                <Text color="gray.500" fontSize="xs" display={{ base: "none", sm: "block" }}>
                                  {new Date(privateMessages[match.id][privateMessages[match.id].length - 1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </Text>
                              )}
                              
                              {/* Show unread badge */}
                              {unreadMessages[match.id] > 0 && (
                                <Badge 
                                  borderRadius="full" 
                                  bg="red.500" 
                                  color="white"
                                  px={2}
                                  fontSize={{ base: "xs", sm: "sm" }}
                                >
                                  {unreadMessages[match.id]}
                                </Badge>
                              )}
                                
                                {/* Chat button for clarity */}
                                <Button 
                                  size="xs" 
                                  colorScheme="pink" 
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent card click
                                    handleOpenChat(match);
                                  }}
                                >
                                  Chat
                                </Button>
                            </HStack>
                          </Flex>
                        </CardBody>
                      </Card>
                      ))
                    )}
                  </VStack>
                ) : (
                  <VStack spacing={{ base: 4, sm: 6 }} align="center" py={{ base: 6, sm: 10 }}>
                    <Box 
                      as="span" 
                      fontSize={{ base: "4xl", sm: "5xl" }}
                      opacity={0.6}
                    >
                      🔒
                    </Box>
                    <Heading size={{ base: "sm", sm: "md" }} color="gray.400" textAlign="center">
                      Private Chats Locked
                    </Heading>
                    <Text color="gray.500" textAlign="center" maxW="md" fontSize={{ base: "sm", sm: "md" }}>
                      When you and someone else both have crushes on each other, you'll unlock a private chat connection here.
                    </Text>
                    <Button 
                      colorScheme="purple" 
                      variant="outline" 
                      onClick={() => setTabIndex(1)}
                      mt={{ base: 2, sm: 4 }}
                      size={{ base: "sm", sm: "md" }}
                    >
                      Go to Members
                    </Button>
                  </VStack>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>
      
      {/* New Confession Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size={{ base: "sm", md: "md" }}>
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent bg={cardBg} rounded="xl" mx={{ base: 3, md: 4 }}>
          <ModalHeader color="brand.300" fontSize={{ base: "lg", md: "xl" }}>New Secret Crush Confession</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Textarea 
              ref={confessionInputRef}
              placeholder="Write about your crush here... No one will know it's you, but they might see it!"
              size="lg"
              minH={{ base: "120px", md: "150px" }}
              value={newConfession}
              onChange={(e) => setNewConfession(e.target.value)}
              bg="dark.700"
              borderColor="dark.600"
              _hover={{ borderColor: 'brand.400' }}
              _focus={{ borderColor: 'brand.300', boxShadow: '0 0 0 1px #ffd43b' }}
              fontSize={{ base: "sm", md: "md" }}
            />
          </ModalBody>

          <ModalFooter>
            <Button 
              colorScheme="brand" 
              mr={3} 
              onClick={handleConfessionSubmit}
              isLoading={isSubmitting}
              loadingText="Posting"
              bgGradient={brandGradient}
              _hover={{ bg: 'brand.400' }}
              rounded="full"
              size={{ base: "sm", md: "md" }}
            >
              Post Anonymously
            </Button>
            <Button 
              variant="ghost" 
              onClick={onClose}
              rounded="full"
              color="gray.400"
              _hover={{ bg: 'dark.700', color: 'white' }}
              size={{ base: "sm", md: "md" }}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Crush Confirmation Modal */}
      <Modal isOpen={isCrushConfirmOpen} onClose={onCrushConfirmClose} isCentered size={{ base: "xs", sm: "sm" }}>
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent bg={cardBg} rounded="xl" mx={{ base: 3, md: 4 }}>
          <ModalHeader color="red.300" fontSize={{ base: "lg", md: "xl" }}>Confirm Your Crush</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedCrush && (
              <VStack spacing={4}>
                <Avatar 
                  size={{ base: "lg", md: "xl" }}
                  name={wallMembers.find(m => m.id === selectedCrush)?.name} 
                  src={wallMembers.find(m => m.id === selectedCrush)?.avatar}
                  border="3px solid"
                  borderColor="red.400"
                />
                <Text textAlign="center" color="white" fontWeight="bold" fontSize={{ base: "md", md: "lg" }}>
                  {wallMembers.find(m => m.id === selectedCrush)?.name}
                </Text>
                <Text textAlign="center" color="gray.300" fontSize={{ base: "xs", md: "sm" }}>
                  This person will only see that someone has a crush on them, but not who it is. You can only have a crush on one person at a time.
                </Text>
                
                {wallMembers.find(m => m.id === currentUser.id)?.hasCrushOn && 
                 wallMembers.find(m => m.id === currentUser.id)?.hasCrushOn !== selectedCrush && (
                  <Box 
                    bg="purple.900" 
                    p={3} 
                    rounded="md" 
                    w="full"
                    borderLeftWidth="4px"
                    borderColor="purple.400"
                  >
                    <Text color="white" fontSize={{ base: "xs", md: "sm" }}>
                      You already have a crush on <Text as="span" fontWeight="bold">
                        {wallMembers.find(m => m.id === wallMembers.find(m => m.id === currentUser.id)?.hasCrushOn)?.name}
                      </Text>. This will replace your current crush.
                    </Text>
                  </Box>
                )}
              </VStack>
            )}
          </ModalBody>

          <ModalFooter>
            <Button 
              colorScheme="red" 
              mr={3} 
              onClick={confirmSetCrush}
              rounded="full"
              size={{ base: "sm", md: "md" }}
            >
              {wallMembers.find(m => m.id === currentUser.id)?.hasCrushOn === selectedCrush
                ? "Confirm Anyway"
                : "Confirm Crush"
              }
            </Button>
            <Button 
              variant="ghost" 
              onClick={onCrushConfirmClose}
              rounded="full"
              color="gray.400"
              size={{ base: "sm", md: "md" }}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Private Chat Modal */}
      <Modal 
        isOpen={isPrivateChatOpen} 
        onClose={onPrivateChatClose} 
        size={{ base: "full", md: "lg" }}
        motionPreset={{ base: "none", md: "scale" }}
        isCentered={false}
        scrollBehavior="inside"
        blockScrollOnMount={true}
      >
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent 
          bg={cardBg} 
          rounded={{ base: "none", md: "xl" }} 
          mx={{ base: 0, md: 4 }} 
          my={{ base: 0, md: "auto" }}
          height={{ base: "100vh", md: "80vh" }}
          maxHeight={{ base: "100vh", md: "80vh" }}
          width={{ base: "100%", md: "auto" }}
          display="flex" 
          flexDirection="column"
          position="relative"
          overflow="hidden"
        >
          {activeChat && (
            <>
              <ModalHeader 
                color="pink.300" 
                borderBottom="1px solid" 
                borderColor="dark.700"
                py={{ base: 2, md: 3 }}
                px={{ base: 3, md: 6 }}
                position="relative"
                zIndex="10"
                boxShadow="0 2px 10px rgba(0,0,0,0.3)"
              >
                <HStack>
                  <Avatar name={activeChat.user.name} src={activeChat.user.avatar} size={{ base: "sm", md: "md" }} />
                  <Box>
                    <Text fontSize={{ base: "md", md: "lg" }}>{activeChat.user.name}</Text>
                    <HStack spacing={2}>
                      <Badge colorScheme="purple" fontSize="xs">
                        {relationships[activeChat.id]?.status || "Just matched"}
                      </Badge>
                      <Text fontSize="xs" color="gray.400">
                        {Math.floor((new Date() - new Date(activeChat.matchTime)) / (1000 * 60 * 60 * 24))} days
                      </Text>
                      {renderConnectionStatus()}
                    </HStack>
                  </Box>
                  <Spacer />
                  <Button 
                    size="xs" 
                    colorScheme="purple" 
                    variant="outline"
                    leftIcon={<Box as="span" fontSize="1em">⚡</Box>}
                    onClick={() => openStatusDialog(activeChat.id)}
                    display={{ base: "none", sm: "flex" }}
                  >
                    Update Status
                  </Button>
                </HStack>
              </ModalHeader>
              <ModalCloseButton 
                position="absolute"
                top={{ base: "10px", md: "16px" }}
                right={{ base: "10px", md: "16px" }}
                zIndex="11"
                color="white"
                size="md"
                bg={{ base: "rgba(0,0,0,0.3)", md: "transparent" }}
                _hover={{ bg: { base: "rgba(0,0,0,0.5)", md: "rgba(255,255,255,0.1)" }}}
                rounded="full"
              />
              
              <Box 
                flex="1" 
                overflow="auto" 
                p={{ base: 3, md: 4 }}
                bg="dark.900" 
                mx={{ base: 0, md: 4 }}
                rounded={{ base: "none", md: "md" }}
                mb={{ base: 0, md: 4 }}
                maxH={{ base: "calc(100vh - 140px)", md: "60vh" }}
                display="flex"
                flexDirection="column"
                gap={3}
              >
                {privateMessages[activeChat.id]?.map(message => (
                  <Box 
                    key={message.id} 
                    mb={2}
                    alignSelf={message.sender === currentUser.id ? 'flex-end' : 'flex-start'}
                    maxW={{ base: "85%", md: "70%" }}
                  >
                    {message.sender === 'system' ? (
                      <Box 
                        bg="purple.900" 
                        p={3} 
                        rounded="md"
                        maxW="100%" 
                        mx="auto" 
                        textAlign="center"
                        borderWidth="1px"
                        borderColor="purple.700"
                      >
                        <Text color="white" fontSize={{ base: "xs", md: "sm" }}>
                          {message.text}
                        </Text>
                      </Box>
                    ) : (
                      <Flex 
                        direction={message.sender === currentUser.id ? 'row-reverse' : 'row'}
                        align="start"
                        gap={2}
                      >
                        <Avatar 
                          name={message.sender === currentUser.id ? currentUser.name : activeChat.user.name} 
                          src={message.sender === currentUser.id ? currentUser.avatar : activeChat.user.avatar} 
                          size="sm" 
                          display={{ base: "none", sm: "block" }}
                        />
                        <Box 
                          bg={message.sender === currentUser.id ? 'brand.500' : 'gray.700'} 
                          p={{ base: 2, md: 3 }}
                          rounded="lg"
                          width="fit-content"
                          maxW="100%"
                        >
                          <Text color="white" fontSize={{ base: "sm", md: "md" }}>
                            {message.text}
                          </Text>
                          <Text color="whiteAlpha.700" fontSize="xs" textAlign="right" mt={1}>
                            {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </Text>
                        </Box>
                      </Flex>
                    )}
                  </Box>
                ))}
                
                {typingIndicators[activeChat.id] && (
                  <Flex align="start" gap={2} mt={1}>
                    <Avatar 
                      name={activeChat.user.name} 
                      src={activeChat.user.avatar} 
                      size="sm" 
                      display={{ base: "none", sm: "block" }}
                    />
                    <Box 
                      bg="gray.800" 
                      p={{ base: 2, md: 3 }}
                      rounded="lg"
                      maxW={{ base: "60%", md: "40%" }}
                    >
                      <HStack spacing={1}>
                        <Box as="span" animation="pulse 1s infinite" opacity={0.8}></Box>
                        <Box as="span" animation="pulse 1s infinite 0.2s" opacity={0.8}></Box>
                        <Box as="span" animation="pulse 1s infinite 0.4s" opacity={0.8}></Box>
                        <style jsx global>{`
                          @keyframes pulse {
                            0% { opacity: 0.4; }
                            50% { opacity: 0.8; }
                            100% { opacity: 0.4; }
                          }
                        `}</style>
                        <Text fontSize={{ base: "xs", md: "sm" }} color="gray.400">typing...</Text>
                      </HStack>
                    </Box>
                  </Flex>
                )}
              </Box>
              
              <ModalFooter 
                py={{ base: 2, md: 5 }}
                px={{ base: 2, md: 4 }}
                borderTop="1px solid"
                borderColor="dark.700"
                position="relative"
                zIndex="10"
                boxShadow="0 -2px 10px rgba(0,0,0,0.2)"
              >
                <InputGroup size={{ base: "md", md: "md" }}>
                  <Input
                    placeholder="Type a message..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    bg="dark.700"
                    borderColor="dark.600"
                    _hover={{ borderColor: 'pink.400' }}
                    _focus={{ borderColor: 'pink.300', boxShadow: '0 0 0 1px #d53f8c' }}
                    pr="4.5rem"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault(); // Prevent default to avoid new line
                        handleSendMessage();
                      }
                    }}
                    fontSize={{ base: "sm", md: "md" }}
                    h={{ base: "40px", md: "auto" }}
                    autoFocus
                  />
                  <InputRightElement width="4.5rem" h={{ base: "40px", md: "100%" }}>
                    <Button 
                      h="1.75rem" 
                      size="sm" 
                      colorScheme="pink"
                      onClick={handleSendMessage}
                      isDisabled={!currentMessage.trim()}
                      _hover={{ transform: 'translateY(-2px)' }}
                      transition="all 0.2s"
                    >
                      Send
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      
      {/* Relationship Status Dialog */}
      <AlertDialog
        isOpen={isStatusOpen}
        leastDestructiveRef={statusCancelRef}
        onClose={onStatusClose}
        isCentered
        size={{ base: "xs", sm: "sm", md: "md" }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="dark.800" borderColor="purple.700" borderWidth="1px" mx={{ base: 3, md: "auto" }}>
            <AlertDialogHeader fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="purple.300">
              Update Relationship Status
            </AlertDialogHeader>

            <AlertDialogBody>
              {activeChat && (
                <VStack spacing={4} align="stretch">
                  <Text color="gray.300" fontSize={{ base: "sm", md: "md" }}>
                    How is your relationship with {activeChat.user.name} going?
                  </Text>
                  
                  <Select 
                    placeholder="Select status" 
                    bg="dark.700"
                    color="white"
                    borderColor="dark.600"
                    value={relationships[activeChat.id]?.status || "Just matched"}
                    onChange={(e) => {
                      // Update local state immediately for better UX
                      setRelationships(prev => ({
                        ...prev,
                        [activeChat.id]: {
                          ...prev[activeChat.id],
                          status: e.target.value,
                          lastUpdated: new Date().toISOString()
                        }
                      }));
                    }}
                    size={{ base: "sm", md: "md" }}
                    fontSize={{ base: "sm", md: "md" }}
                    _focus={{ borderColor: 'purple.400', boxShadow: '0 0 0 1px var(--chakra-colors-purple-400)' }}
                    sx={{
                      '& option': { 
                        background: 'var(--chakra-colors-dark-700)',
                        color: 'white'
                      }
                    }}
                  >
                    {relationshipStatusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </Select>
                  
                  <Box>
                    <Text fontSize={{ base: "xs", md: "sm" }} color="gray.400" mb={2}>
                      Relationship timeline
                    </Text>
                    <Progress 
                      value={relationshipStatusOptions.indexOf(relationships[activeChat.id]?.status || "Just matched") / (relationshipStatusOptions.length - 1) * 100} 
                      colorScheme="purple" 
                      rounded="md"
                      size="sm"
                      hasStripe
                      animation="progress-stripe 1s linear infinite"
                      sx={{
                        '@keyframes progress-stripe': {
                          '0%': { backgroundPosition: '1rem 0' },
                          '100%': { backgroundPosition: '0 0' }
                        }
                      }}
                    />
                  </Box>
                </VStack>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button 
                ref={statusCancelRef} 
                onClick={onStatusClose} 
                variant="ghost" 
                color="gray.300"
                size={{ base: "sm", md: "md" }}
              >
                Cancel
              </Button>
              <Button 
                colorScheme="purple" 
                ml={3} 
                onClick={() => {
                  if (activeChat) {
                    updateRelationshipStatus(relationships[activeChat.id]?.status || "Just matched");
                  } else {
                    onStatusClose();
                  }
                }}
                size={{ base: "sm", md: "md" }}
                isLoading={isUpdatingStatus}
                loadingText="Saving"
                _hover={{ 
                  transform: 'translateY(-2px)',
                  boxShadow: 'md' 
                }}
                transition="all 0.2s"
              >
                Save
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      
      {/* Anniversary Reminder Dialog */}
      <Modal isOpen={showAnniversaryReminder} onClose={dismissAnniversary} isCentered size={{ base: "xs", sm: "md" }}>
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent 
          bg="dark.800" 
          rounded="xl" 
          mx={{ base: 3, md: 4 }}
          borderWidth="1px"
          borderColor="pink.500"
          bgGradient="linear(to-br, pink.900, purple.900)"
        >
          {anniversaryData && (
            <>
              <ModalHeader color="white" textAlign="center" fontSize={{ base: "lg", md: "xl" }}>
                <HStack justify="center" mb={2}>
                  <Box as="span" fontSize={{ base: "xl", md: "2xl" }}>🎉</Box>
                  <Text>Relationship Milestone!</Text>
                  <Box as="span" fontSize={{ base: "xl", md: "2xl" }}>🎉</Box>
                </HStack>
              </ModalHeader>
              <ModalCloseButton color="white" />
              
              <ModalBody pb={6}>
                <VStack spacing={4}>
                  <HStack spacing={1} justify="center">
                    <Avatar 
                      size={{ base: "sm", md: "md" }}
                      name={currentUser.name} 
                      src={currentUser.avatar}
                      border="2px solid"
                      borderColor="brand.400"
                    />
                    <Box as="span" fontSize={{ base: "lg", md: "xl" }} mx={1}>💕</Box>
                    <Avatar 
                      size={{ base: "sm", md: "md" }}
                      name={anniversaryData.userName} 
                      src={anniversaryData.userAvatar}
                      border="2px solid"
                      borderColor="pink.400"
                    />
                  </HStack>
                  
                  <Text color="white" textAlign="center" fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                    Congratulations on your {anniversaryData.days}-day anniversary with {anniversaryData.userName}!
                  </Text>
                  
                  <Text color="pink.100" textAlign="center" fontSize={{ base: "xs", md: "sm" }}>
                    Would you like to celebrate this milestone in your chat?
                  </Text>
                </VStack>
              </ModalBody>

              <ModalFooter>
                <Button 
                  variant="outline" 
                  mr={3} 
                  onClick={dismissAnniversary}
                  borderColor="whiteAlpha.400"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.200' }}
                  size={{ base: "sm", md: "md" }}
                >
                  Maybe Later
                </Button>
                <Button 
                  bgGradient={pinkGradient}
                  _hover={{ bg: 'pink.400' }}
                  color="white"
                  onClick={celebrateAnniversary}
                  leftIcon={<Box as="span" fontSize="1.2em">🎂</Box>}
                  size={{ base: "sm", md: "md" }}
                >
                  Celebrate Now
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Box>
  );
}