import { useState, useEffect, useRef, useCallback } from 'react';

// WebSocket service for real-time chat
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds initial delay
const listeners = new Map();
let userId = null;
let wallId = null;

// Connection status constants
export const CONNECTION_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

// Event types for WebSocket messages
export const EVENT_TYPES = {
  CHAT_MESSAGE: 'chat_message',
  TYPING_INDICATOR: 'typing_indicator',
  USER_STATUS: 'user_status',
  CRUSH_UPDATE: 'crush_update',
  MUTUAL_MATCH: 'mutual_match',
  SYSTEM_MESSAGE: 'system_message'
};

// Initialize WebSocket connection
export const initializeSocket = (currentUserId, currentWallId) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected, closing previous connection');
    socket.close();
  }
  
  userId = currentUserId;
  wallId = currentWallId;
  
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = process.env.NEXT_PUBLIC_WS_HOST || 'akf.digital';
  const wsURL = `${wsProtocol}//${wsHost}?user_id=${userId}&wall_id=${wallId}`;
  
  console.log(`Initializing WebSocket connection to ${wsURL}`);
  
  try {
    socket = new WebSocket(wsURL);
    
    socket.onopen = () => {
      console.log('WebSocket connection established');
      reconnectAttempts = 0;
      notifyListeners(EVENT_TYPES.SYSTEM_MESSAGE, {
        type: 'connection',
        status: CONNECTION_STATUS.CONNECTED,
        message: 'Connected to chat server'
      });
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type && data.payload) {
          notifyListeners(data.type, data.payload);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
      notifyListeners(EVENT_TYPES.SYSTEM_MESSAGE, {
        type: 'connection',
        status: CONNECTION_STATUS.DISCONNECTED,
        message: 'Disconnected from chat server'
      });
      
      // Attempt to reconnect if not a clean closure
      if (event.code !== 1000) {
        attemptReconnect();
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      notifyListeners(EVENT_TYPES.SYSTEM_MESSAGE, {
        type: 'connection',
        status: CONNECTION_STATUS.ERROR,
        message: 'Error connecting to chat server'
      });
    };
    
    return true;
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    return false;
  }
};

// Attempt to reconnect with exponential backoff
const attemptReconnect = () => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('Maximum reconnection attempts reached');
    notifyListeners(EVENT_TYPES.SYSTEM_MESSAGE, {
      type: 'connection',
      status: CONNECTION_STATUS.ERROR,
      message: 'Unable to reconnect to chat server after multiple attempts'
    });
    return;
  }
  
  const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;
  
  console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  notifyListeners(EVENT_TYPES.SYSTEM_MESSAGE, {
    type: 'connection',
    status: CONNECTION_STATUS.CONNECTING,
    message: `Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
  });
  
  setTimeout(() => {
    if (userId && wallId) {
      initializeSocket(userId, wallId);
    }
  }, delay);
};

// Send a message over WebSocket
export const sendMessage = (type, payload) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not connected');
    return false;
  }
  
  try {
    const message = JSON.stringify({
      type,
      payload: {
        ...payload,
        sender_id: userId,
        wall_id: wallId,
        timestamp: new Date().toISOString()
      }
    });
    
    socket.send(message);
    return true;
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
    return false;
  }
};

// Send a chat message
export const sendChatMessage = (chatId, messageText, isSystemMessage = false) => {
  return sendMessage(EVENT_TYPES.CHAT_MESSAGE, {
    chat_id: chatId,
    message: messageText,
    is_system_message: isSystemMessage
  });
};

// Send typing indicator
export const sendTypingIndicator = (chatId, isTyping) => {
  return sendMessage(EVENT_TYPES.TYPING_INDICATOR, {
    chat_id: chatId,
    is_typing: isTyping
  });
};

// Subscribe to WebSocket events
export const subscribe = (eventType, callback) => {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  
  const eventListeners = listeners.get(eventType);
  eventListeners.add(callback);
  
  // Return unsubscribe function
  return () => {
    eventListeners.delete(callback);
    if (eventListeners.size === 0) {
      listeners.delete(eventType);
    }
  };
};

// Notify all listeners of an event
const notifyListeners = (eventType, data) => {
  if (listeners.has(eventType)) {
    listeners.get(eventType).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in WebSocket event listener for ${eventType}:`, error);
      }
    });
  }
  
  // Also notify system message listeners for all events if they're interested
  if (eventType !== EVENT_TYPES.SYSTEM_MESSAGE && listeners.has(EVENT_TYPES.SYSTEM_MESSAGE)) {
    listeners.get(EVENT_TYPES.SYSTEM_MESSAGE).forEach(callback => {
      try {
        callback({
          type: 'event',
          event_type: eventType,
          data
        });
      } catch (error) {
        console.error('Error in WebSocket system listener:', error);
      }
    });
  }
};

// Close WebSocket connection
export const closeConnection = () => {
  if (socket) {
    socket.close(1000, 'User initiated closure');
    socket = null;
    userId = null;
    wallId = null;
    reconnectAttempts = 0;
    return true;
  }
  return false;
};

// React hook for using WebSocket
export const useWebSocket = (currentUserId, currentWallId) => {
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  
  // Initialize connection
  useEffect(() => {
    if (currentUserId && currentWallId) {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      
      const success = initializeSocket(currentUserId, currentWallId);
      if (!success) {
        setConnectionStatus(CONNECTION_STATUS.ERROR);
        setError('Failed to initialize WebSocket connection');
      }
      
      // Set up system message listener
      const unsubscribe = subscribe(EVENT_TYPES.SYSTEM_MESSAGE, (data) => {
        if (data.type === 'connection') {
          setConnectionStatus(data.status);
          if (data.status === CONNECTION_STATUS.ERROR) {
            setError(data.message);
          } else {
            setError(null);
          }
        }
        
        // Update lastMessage for all system messages
        setLastMessage({
          type: EVENT_TYPES.SYSTEM_MESSAGE,
          payload: data,
          timestamp: new Date().toISOString()
        });
      });
      
      // Clean up on unmount
      return () => {
        unsubscribe();
        closeConnection();
      };
    }
  }, [currentUserId, currentWallId]);
  
  // Helper function to subscribe to events with auto-cleanup
  const subscribeToEvent = useCallback((eventType, callback) => {
    return subscribe(eventType, callback);
  }, []);
  
  return {
    connectionStatus,
    lastMessage,
    error,
    sendMessage: (type, payload) => sendMessage(type, payload),
    sendChatMessage: (chatId, message, isSystemMessage) => 
      sendChatMessage(chatId, message, isSystemMessage),
    sendTypingIndicator: (chatId, isTyping) => 
      sendTypingIndicator(chatId, isTyping),
    subscribe: subscribeToEvent,
    closeConnection
  };
};

export default useWebSocket; 