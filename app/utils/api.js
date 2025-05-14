/**
 * API Utilities
 * Real API integration with backend services
 */

// Base API URL - update this to your production URL when deploying
// Use relative URL for same-origin requests to avoid CORS issues
const API_BASE_URL = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' 
    ? 'http://localhost/wink_trap/api'
    : '/api')
  : '/api';

console.log('API_BASE_URL:', API_BASE_URL);

// API Endpoint URLs
export const API_ENDPOINTS = {
  // Auth endpoints
  auth: {
    register: `${API_BASE_URL}/auth/register.php`,
    login: `${API_BASE_URL}/auth/login.php`,
    logout: `${API_BASE_URL}/auth/logout.php`,
    verify: `${API_BASE_URL}/auth/verify.php`,
    profile: `${API_BASE_URL}/users/profile.php`,
  },
  
  // Wall endpoints
  walls: {
    create: `${API_BASE_URL}/walls/create.php`,
    join: `${API_BASE_URL}/walls/join.php`,
    list: `${API_BASE_URL}/walls/list.php`,
    update: `${API_BASE_URL}/walls/update.php`,
    details: `${API_BASE_URL}/walls/details.php`,
    members: `${API_BASE_URL}/walls/members.php`,
    confessions: `${API_BASE_URL}/walls/confessions.php`,
    crush: `${API_BASE_URL}/walls/crush.php`,
    like: `${API_BASE_URL}/walls/like.php`,
    comments: `${API_BASE_URL}/walls/comments.php`,
    chat: `${API_BASE_URL}/walls/chat.php`,
  },
  
  // User endpoints
  users: {
    profile: `${API_BASE_URL}/users/profile.php`,
  },
};

// Enable real API mode
const DEMO_MODE = false;

/**
 * Make an API request to the server
 * @param {string} endpoint - The API endpoint
 * @param {Object} options - The request options
 * @returns {Promise<Object>} API response
 */
export const apiRequest = async (endpoint, options = {}) => {
  try {
    // Set the default headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Add auth token if it exists (safely check for localStorage in browser)
    if (typeof window !== 'undefined') {
      try {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    // For FormData requests, don't set Content-Type header (browser will set it with boundary)
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }
    
    // Ensure credentials are included for session cookies
    const requestOptions = {
      ...options,
      headers,
      // Only use CORS for cross-origin requests
      mode: endpoint.startsWith('http') ? 'cors' : 'same-origin',
      // Always include credentials for authentication cookies
      credentials: 'include',
    };
    
    console.log(`Making API request to ${endpoint}`, { 
      method: requestOptions.method || 'GET',
      mode: requestOptions.mode,
      credentials: requestOptions.credentials,
      isFormData: options.body instanceof FormData
    });
    
    // Set a timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // Add signal to request options
    requestOptions.signal = controller.signal;
    
    // Make the request with credentials included for cookies
    const response = await fetch(endpoint, requestOptions);
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Try to parse JSON, if it fails return a meaningful error
    let data;
    try {
      // First check if there's content to parse
      const text = await response.text();
      // Try to parse as JSON if text is not empty
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (jsonError) {
          console.error('Failed to parse response as JSON:', text);
          // Create a structured error with the original text
          data = {
            message: 'Invalid JSON response from server',
            originalText: text.length > 500 ? text.substring(0, 500) + '...' : text
          };
        }
      } else {
        data = {}; // Empty response
      }
    } catch (error) {
      console.error('Error reading response text:', error);
      return {
        success: false,
        status: response.status,
        data: {
          message: 'Error reading server response',
          originalError: error.message
        },
      };
    }
    
    // Log failed responses for debugging
    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`, data);
    }
    
    // Return the response
    return {
      success: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('API request failed with network error:', error);
    
    // Check for specific error types
    let errorMessage = 'Network error. Please check your connection.';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out. Server might be too slow to respond.';
    } else if (error.message?.includes('NetworkError')) {
      errorMessage = 'Network connection lost. Please check your internet connection.';
    } else if (error.message?.includes('Failed to fetch')) {
      errorMessage = 'Connection to server failed. Please try again later.';
    } else if (error.message?.includes('CORS')) {
      errorMessage = 'CORS error: Cross-origin request blocked. Please check server configuration.';
    }
    
    // Return formatted error response
    return {
      success: false,
      status: 0, // 0 indicates network error
      data: {
        message: errorMessage,
        originalError: error.message || 'Unknown error'
      },
    };
  }
};

/**
 * Create a wall
 * @param {Object} wallData - The wall data
 * @returns {Promise<Object>} API response
 */
export const createWall = async (wallData) => {
  // For multipart form data (file uploads)
  const formData = new FormData();
  
  console.log('Creating wall with data:', {
    name: wallData.name,
    wallId: wallData.wallId,
    hasPassword: !!wallData.password,
    hasDescription: !!wallData.description,
    hasImage: !!wallData.image
  });
  
  // Add wall data fields - make sure field names exactly match what the server expects
  formData.append('name', wallData.name);
  formData.append('password', wallData.password);
  
  if (wallData.wallId) {
    formData.append('wallId', wallData.wallId);
  }
  
  // Add description if available
  if (wallData.description !== undefined) {
    formData.append('description', wallData.description);
  }
  
  // Add image if available - the server expects the field to be named 'image'
  if (wallData.image && wallData.image instanceof File) {
    console.log('Appending image to form data:', wallData.image.name, wallData.image.type, wallData.image.size);
    formData.append('image', wallData.image);
  }
  
  // Debug: Log all form data contents
  console.log('FormData entries:');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value instanceof File ? `File(${value.name}, ${value.type}, ${value.size})` : value}`);
  }
  
  try {
    // Get auth token
    const token = localStorage.getItem('auth_token');
    
    // Set up request options - do NOT set Content-Type for FormData
    const options = {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData - browser will set correct boundary
        'Authorization': token ? `Bearer ${token}` : '',
      },
      // Important: Include credentials for cookies (session)
      credentials: 'include'
    };
    
    // Log request details
    console.log(`Making wall creation request to ${API_ENDPOINTS.walls.create}`, { 
      method: options.method,
      credentials: options.credentials,
      hasAuthorization: !!options.headers.Authorization
    });
    
    // Make API request
    const response = await apiRequest(API_ENDPOINTS.walls.create, options);
    console.log('Wall creation response:', response);
    return response;
  } catch (error) {
    console.error('Create wall API request failed:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to create wall: ' + (error.message || 'Unknown error'),
      },
    };
  }
};

/**
 * Check if the user is authenticated
 * @returns {Promise<boolean>} Authentication status
 */
export const isAuthenticated = async () => {
  try {
    const response = await verifySession();
    return response.success;
  } catch (error) {
    return false;
  }
};

/**
 * Register a new user
 * @param {Object} userData - The user data
 * @returns {Promise<Object>} API response
 */
export const registerUser = async (userData) => {
  const options = {
    method: 'POST',
    body: JSON.stringify(userData),
  };
  
  return await apiRequest(API_ENDPOINTS.auth.register, options);
};

/**
 * Login a user
 * @param {Object} credentials - The user credentials
 * @returns {Promise<Object>} API response
 */
export const loginUser = async (credentials) => {
  try {
    console.log('Logging in with credentials:', { email: credentials.email, passwordProvided: !!credentials.password });
    
  const options = {
    method: 'POST',
    body: JSON.stringify(credentials),
      headers: {
        'Content-Type': 'application/json',
      },
      // Always include credentials for auth cookies
      credentials: 'include',
    };
    
    console.log(`Making login request to ${API_ENDPOINTS.auth.login}`, { 
      method: options.method,
      credentials: options.credentials
    });
    
    // Make request with improved error handling
  return await apiRequest(API_ENDPOINTS.auth.login, options);
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Login request failed: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Logout a user
 * @returns {Promise<Object>} API response
 */
export const logoutUser = async () => {
  const options = {
    method: 'POST',
  };
  
  return await apiRequest(API_ENDPOINTS.auth.logout, options);
};

/**
 * Get user profile
 * @returns {Promise<Object>} API response
 */
export const getUserProfile = async () => {
  try {
    console.log('Getting user profile');
    
  const options = {
    method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json'
      },
      mode: 'cors' // Explicitly set CORS mode
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making profile request to ${API_ENDPOINTS.users.profile}`, { 
      method: options.method,
      credentials: options.credentials,
      headers: Object.keys(options.headers),
      mode: options.mode
    });
    
    // Make direct fetch request to avoid any middleware issues
    const response = await fetch(API_ENDPOINTS.users.profile, options);
    
    console.log('Profile response status:', response.status);
    
    // Handle the response
    let data;
    try {
      const text = await response.text();
      console.log('Raw profile response text length:', text.length);
      data = text ? JSON.parse(text) : {};
    } catch (jsonError) {
      console.error('Error parsing profile response:', jsonError);
      return {
        success: false,
        status: response.status,
        data: {
          message: 'Invalid response format from server'
        }
      };
    }
    
    // Return processed response
    const processedResponse = {
      success: response.ok,
      status: response.status,
      data: data
    };
    
    // Handle the specific data structure from our backend
    if (processedResponse.success && processedResponse.data?.data) {
      // Map the nested data structure to the top level for compatibility
      processedResponse.data.name = processedResponse.data.data.name;
      processedResponse.data.email = processedResponse.data.data.email;
      processedResponse.data.profile_pic = processedResponse.data.data.profile_pic;
    }
    
    return processedResponse;
  } catch (error) {
    console.error('Get user profile error:', error);
    return {
      success: false,
      status: 0,
      data: {
        message: 'Failed to get user profile: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Update user profile
 * @param {Object|FormData} profileData - The profile data to update, either as an object or FormData
 * @returns {Promise<Object>} API response
 */
export const updateUserProfile = async (profileData) => {
  let formData;
  
  console.log('updateUserProfile called with:', profileData instanceof FormData ? 'FormData object' : typeof profileData);
  
  // Check if profileData is already FormData
  if (profileData instanceof FormData) {
    formData = profileData;
    console.log('Using provided FormData');
    
    // Log FormData contents for debugging
    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}: ${value instanceof File ? value.name : value}`);
    }
  } else {
    // Convert object to FormData
    formData = new FormData();
    console.log('Converting object to FormData');
    
    // Append all profile data
    Object.keys(profileData).forEach(key => {
      if (key === 'profile_pic' && profileData[key] instanceof File) {
        formData.append(key, profileData[key]);
        console.log(`Added file ${key}: ${profileData[key].name}`);
      } else {
        formData.append(key, profileData[key]);
        console.log(`Added ${key}: ${profileData[key]}`);
      }
    });
  }
  
  // Get auth token for authorization
  let token = '';
  if (typeof window !== 'undefined') {
    try {
      token = localStorage.getItem('auth_token') || '';
    } catch (e) {
      console.error('Error accessing localStorage for auth token:', e);
    }
  }
  
  const options = {
    method: 'POST',
    body: formData,
    headers: {
      // Don't set Content-Type for FormData - browser will set it with boundary
      'Authorization': token ? `Bearer ${token}` : ''
    },
    credentials: 'include' // Include cookies for session authentication
  };
  
  console.log(`Making profile update request to ${API_ENDPOINTS.users.profile}`);
  const response = await apiRequest(API_ENDPOINTS.users.profile, options);
  console.log('Profile update response:', response);
  
  return response;
};

/**
 * Get walls
 * @returns {Promise<Object>} API response
 */
export const getWalls = async () => {
  try {
    console.log('Getting walls list');
    
  const options = {
    method: 'GET',
      headers: {},
      credentials: 'include' // Ensure credentials are included
    };
    
    // Get auth token for authorization if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making walls list request to ${API_ENDPOINTS.walls.list}`);
  
  return await apiRequest(API_ENDPOINTS.walls.list, options);
  } catch (error) {
    console.error('Get walls error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to get walls: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Join a wall
 * @param {Object} joinData - The wall ID and password
 * @returns {Promise<Object>} API response
 */
export const joinWall = async (joinData) => {
  try {
    console.log('Joining wall with data:', {
      wallId: joinData.wallId,
      hasPassword: !!joinData.password
    });
    
  const options = {
    method: 'POST',
    body: JSON.stringify(joinData),
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Ensure credentials are included
    };
    
    // Get auth token for authorization if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making wall join request to ${API_ENDPOINTS.walls.join}`);
  
  return await apiRequest(API_ENDPOINTS.walls.join, options);
  } catch (error) {
    console.error('Wall join error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to join wall: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Verify session
 * @returns {Promise<Object>} API response
 */
export const verifySession = async () => {
  console.log('Verifying session...');
  
  try {
  const options = {
    method: 'GET',
      credentials: 'include', // Important for cookies
    };
    
    const response = await apiRequest(API_ENDPOINTS.auth.verify, options);
    
    console.log('Session verification response:', response);
    
    // If we don't get a valid response, create a more detailed error
    if (!response.success) {
      console.error('Session verification failed:', response);
      
      // Special handling for network/connection errors
      if (response.status === 0 || response.status >= 500) {
        return {
          success: false,
          status: response.status,
          data: {
            message: 'Cannot connect to the server. Please check your internet connection.'
          }
        };
      }
    }
    
    return response;
  } catch (error) {
    console.error('Session verification error:', error);
    
    // Return a formatted error response
    return {
      success: false,
      status: 0,
      data: {
        message: `Session verification error: ${error.message}`
      }
    };
  }
};

/**
 * Update an existing wall
 * @param {Object} wallData - The wall data to update
 * @returns {Promise<Object>} API response
 */
export const updateWall = async (wallData) => {
  // For multipart form data (file uploads)
  const formData = new FormData();
  
  console.log('Updating wall with data:', {
    id: wallData.id,
    name: wallData.name,
    hasDescription: !!wallData.description,
    hasImage: !!wallData.image
  });
  
  // Add wall ID - this is required
  formData.append('wall_id', wallData.id);
  
  // Add name if provided
  if (wallData.name) {
    formData.append('name', wallData.name);
  }
  
  // Add description if provided
  if (wallData.description !== undefined) {
    formData.append('description', wallData.description);
  }
  
  // Add image if available
  if (wallData.image && wallData.image instanceof File) {
    console.log('Appending image to form data:', wallData.image.name, wallData.image.type, wallData.image.size);
    formData.append('image', wallData.image);
  }
  
  // Debug: Log all form data contents
  console.log('FormData entries:');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value instanceof File ? `File(${value.name}, ${value.type}, ${value.size})` : value}`);
  }
  
  try {
    // Get auth token
    const token = localStorage.getItem('auth_token');
    
    // Set up request options - do NOT set Content-Type for FormData
    const options = {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData - browser will set correct boundary
        'Authorization': token ? `Bearer ${token}` : '',
      },
      // Important: Include credentials for cookies (session)
      credentials: 'include'
    };
    
    // Log request details
    console.log(`Making wall update request to ${API_ENDPOINTS.walls.update}`, { 
      method: options.method,
      credentials: options.credentials,
      hasAuthorization: !!options.headers.Authorization
    });
    
    // Make API request
    const response = await apiRequest(API_ENDPOINTS.walls.update, options);
    console.log('Wall update response:', response);
    return response;
  } catch (error) {
    console.error('Wall update request failed:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to update wall: ' + (error.message || 'Unknown error'),
      },
    };
  }
};

/**
 * Get wall details
 * @param {string} wallId - The wall ID
 * @returns {Promise<Object>} API response
 */
export const getWallDetails = async (wallId) => {
  try {
    if (!wallId) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID is required' }
      };
    }

    const options = {
      method: 'GET',
      headers: {},
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    const queryParams = new URLSearchParams({ id: wallId }).toString();
    console.log(`Making wall details request to ${API_ENDPOINTS.walls.details}?${queryParams}`);
    
    return await apiRequest(`${API_ENDPOINTS.walls.details}?${queryParams}`, options);
  } catch (error) {
    console.error('Get wall details error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to get wall details: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Get wall members
 * @param {string} wallId - The wall ID
 * @returns {Promise<Object>} API response
 */
export const getWallMembers = async (wallId) => {
  try {
    if (!wallId) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID is required' }
      };
    }

    const options = {
      method: 'GET',
      headers: {},
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    const queryParams = new URLSearchParams({ id: wallId }).toString();
    console.log(`Making wall members request to ${API_ENDPOINTS.walls.members}?${queryParams}`);
    
    return await apiRequest(`${API_ENDPOINTS.walls.members}?${queryParams}`, options);
  } catch (error) {
    console.error('Get wall members error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to get wall members: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Get wall confessions
 * @param {string} wallId - The wall ID
 * @returns {Promise<Object>} API response
 */
export const getWallConfessions = async (wallId) => {
  try {
    if (!wallId) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID is required' }
      };
    }

    const options = {
      method: 'GET',
      headers: {},
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    const queryParams = new URLSearchParams({ id: wallId }).toString();
    console.log(`Making wall confessions request to ${API_ENDPOINTS.walls.confessions}?${queryParams}`);
    
    return await apiRequest(`${API_ENDPOINTS.walls.confessions}?${queryParams}`, options);
  } catch (error) {
    console.error('Get wall confessions error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to get wall confessions: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Post a confession to a wall
 * @param {Object} confessionData - The confession data
 * @param {string} confessionData.wall_id - The wall ID
 * @param {string} confessionData.text - The confession text
 * @returns {Promise<Object>} API response
 */
export const postConfession = async (confessionData) => {
  try {
    if (!confessionData.wall_id || !confessionData.text) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID and confession text are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(confessionData),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making post confession request to ${API_ENDPOINTS.walls.confessions}`);
    
    return await apiRequest(API_ENDPOINTS.walls.confessions, options);
  } catch (error) {
    console.error('Post confession error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to post confession: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Set a crush on another wall member
 * @param {Object} crushData - The crush data
 * @param {string} crushData.wall_id - The wall ID
 * @param {number} crushData.target_user_id - The target user ID to crush on
 * @returns {Promise<Object>} API response
 */
export const setCrush = async (crushData) => {
  try {
    if (!crushData.wall_id || !crushData.target_user_id) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID and target user ID are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...crushData,
        action: 'set'
      }),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making set crush request to ${API_ENDPOINTS.walls.crush}`);
    
    return await apiRequest(API_ENDPOINTS.walls.crush, options);
  } catch (error) {
    console.error('Set crush error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to set crush: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Remove a crush from a user in a wall
 * @param {Object} crushData - Crush data
 * @param {string} crushData.wall_id - Wall ID
 * @param {boolean} [crushData.test_mode] - Set to true to bypass the 4-hour restriction (for testing only)
 * @returns {Promise<Object>} API response
 */
export const removeCrush = async (crushData) => {
  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...crushData,
        action: 'remove'
      }),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error getting token from localStorage:', e);
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/walls/crush.php`, options);
    
    if (!response.ok) {
      // For status codes other than 401, return the error response
      const errorData = await response.json();
      return {
        success: false,
        status: response.status,
        data: errorData
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      status: response.status,
      data
    };
  } catch (error) {
    console.error('API Error in removeCrush:', error);
    return {
      success: false,
      status: 500,
      data: { message: error.message }
    };
  }
};

/**
 * Like a confession
 * @param {Object} likeData - The like data
 * @param {number} likeData.confession_id - The confession ID to like
 * @param {string} likeData.action - The action to perform ('like' or 'unlike')
 * @returns {Promise<Object>} API response
 */
export const likeConfession = async (likeData) => {
  try {
    if (!likeData.confession_id) {
      return {
        success: false,
        status: 400,
        data: { message: 'Confession ID is required' }
      };
    }
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(likeData),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making ${likeData.action || 'like'} confession request to ${API_ENDPOINTS.walls.like}`);
    
    return await apiRequest(API_ENDPOINTS.walls.like, options);
  } catch (error) {
    console.error('Like confession error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: `Failed to ${likeData.action || 'like'} confession: ` + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Get comments for a confession
 * @param {number} confessionId - The confession ID
 * @returns {Promise<Object>} API response
 */
export const getComments = async (confessionId) => {
  try {
    if (!confessionId) {
      return {
        success: false,
        status: 400,
        data: { message: 'Confession ID is required' }
      };
    }

    const options = {
      method: 'GET',
      headers: {},
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    const queryParams = new URLSearchParams({ confession_id: confessionId }).toString();
    console.log(`Making get comments request to ${API_ENDPOINTS.walls.comments}?${queryParams}`);
    
    return await apiRequest(`${API_ENDPOINTS.walls.comments}?${queryParams}`, options);
  } catch (error) {
    console.error('Get comments error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to get comments: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Add a comment to a confession
 * @param {Object} commentData - The comment data
 * @param {number} commentData.confession_id - The confession ID
 * @param {string} commentData.text - The comment text
 * @returns {Promise<Object>} API response
 */
export const addComment = async (commentData) => {
  try {
    if (!commentData.confession_id || !commentData.text) {
      return {
        success: false,
        status: 400,
        data: { message: 'Confession ID and comment text are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commentData),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making add comment request to ${API_ENDPOINTS.walls.comments}`);
    
    return await apiRequest(API_ENDPOINTS.walls.comments, options);
  } catch (error) {
    console.error('Add comment error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to add comment: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Like a comment
 * @param {Object} likeData - The like data
 * @param {number} likeData.comment_id - The comment ID to like
 * @param {string} likeData.action - The action to perform ('like' or 'unlike')
 * @returns {Promise<Object>} API response
 */
export const likeComment = async (likeData) => {
  try {
    if (!likeData.comment_id) {
      return {
        success: false,
        status: 400,
        data: { message: 'Comment ID is required' }
      };
    }
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(likeData),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making ${likeData.action || 'like'} comment request to ${API_ENDPOINTS.walls.like}`);
    
    return await apiRequest(API_ENDPOINTS.walls.like, options);
  } catch (error) {
    console.error('Like comment error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: `Failed to ${likeData.action || 'like'} comment: ` + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Add a reply to a comment
 * @param {Object} replyData - The reply data
 * @param {number} replyData.comment_id - The comment ID to reply to
 * @param {string} replyData.text - The reply text
 * @returns {Promise<Object>} API response
 */
export const addReply = async (replyData) => {
  try {
    if (!replyData.comment_id || !replyData.text) {
      return {
        success: false,
        status: 400,
        data: { message: 'Comment ID and reply text are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(replyData),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making add reply request to ${API_ENDPOINTS.walls.comments}`);
    
    return await apiRequest(API_ENDPOINTS.walls.comments, options);
  } catch (error) {
    console.error('Add reply error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to add reply: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Create a private chat between mutual crushes
 * @param {Object} chatData - Chat data
 * @param {string} chatData.wall_id - Wall ID
 * @param {number} chatData.target_user_id - The user to chat with
 * @param {boolean} [chatData.dev_mode] - Whether to enable development mode (bypass mutual crush check)
 * @returns {Promise<Object>} API response
 */
export const createPrivateChat = async (chatData) => {
  try {
    if (!chatData.wall_id || !chatData.target_user_id) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID and target user ID are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...chatData,
        action: 'create_chat',
        dev_mode: chatData.dev_mode || false
      }),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making create private chat request to ${API_ENDPOINTS.walls.chat}`, {
      wall_id: chatData.wall_id,
      target_user_id: chatData.target_user_id,
      dev_mode: chatData.dev_mode || false
    });
    
    return await apiRequest(API_ENDPOINTS.walls.chat, options);
  } catch (error) {
    console.error('Create private chat error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to create private chat: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Get private chats for the current user
 * @param {Object} data - Chat data
 * @param {string} data.wall_id - Wall ID
 * @returns {Promise<Object>} API response with chats
 */
export const getPrivateChats = async (data) => {
  try {
    if (!data.wall_id) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID is required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        action: 'get_chats'
      }),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Getting private chats from ${API_ENDPOINTS.walls.chat}`);
    
    return await apiRequest(API_ENDPOINTS.walls.chat, options);
  } catch (error) {
    console.error('Get private chats error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to get private chats: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Send a message in a private chat
 * @param {Object} data - Message data
 * @param {string} data.wall_id - Wall ID
 * @param {number} data.chat_id - Chat ID
 * @param {string} data.message - Message text
 * @returns {Promise<Object>} API response
 */
export const sendChatMessage = async (data) => {
  try {
    if (!data.wall_id || !data.chat_id || !data.message) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID, chat ID, and message are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        action: 'send_message'
      }),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Sending chat message to ${API_ENDPOINTS.walls.chat}`);
    
    return await apiRequest(API_ENDPOINTS.walls.chat, options);
  } catch (error) {
    console.error('Send chat message error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to send message: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Get chat messages
 * @param {Object} data - Chat data
 * @param {string} data.wall_id - Wall ID
 * @param {number} data.chat_id - Chat ID
 * @returns {Promise<Object>} API response
 */
export const getChatMessages = async (data) => {
  try {
    if (!data.wall_id || !data.chat_id) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID and chat ID are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        action: 'get_messages'
      }),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making get chat messages request to ${API_ENDPOINTS.walls.chat}`, {
      wall_id: data.wall_id,
      chat_id: data.chat_id
    });
    
    return await apiRequest(API_ENDPOINTS.walls.chat, options);
  } catch (error) {
    console.error('Get chat messages error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to get chat messages: ' + (error.message || 'Unknown error')
      }
    };
  }
};

/**
 * Update relationship status
 * @param {Object} data - Relationship data
 * @param {string} data.wall_id - Wall ID
 * @param {number} data.chat_id - Chat ID
 * @param {string} data.status - New relationship status
 * @returns {Promise<Object>} API response
 */
export const updateRelationshipStatus = async (data) => {
  try {
    if (!data.wall_id || !data.chat_id || !data.status) {
      return {
        success: false,
        status: 400,
        data: { message: 'Wall ID, chat ID, and status are required' }
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        action: 'update_relationship'
      }),
      credentials: 'include'
    };
    
    // Add auth token if available
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error accessing localStorage for auth token:', e);
      }
    }
    
    console.log(`Making update relationship status request to ${API_ENDPOINTS.walls.chat}`, {
      wall_id: data.wall_id,
      chat_id: data.chat_id,
      status: data.status
    });
    
    return await apiRequest(API_ENDPOINTS.walls.chat, options);
  } catch (error) {
    console.error('Update relationship status error:', error);
    return {
      success: false,
      status: 500,
      data: {
        message: 'Failed to update relationship status: ' + (error.message || 'Unknown error')
      }
    };
  }
}; 