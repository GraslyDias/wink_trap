<?php
/**
 * Authentication Utilities
 * This file contains helper functions for user authentication
 */

// Include database configuration if not already included
if (!function_exists('getDbConnection')) {
    require_once __DIR__ . '/../config/database.php';
}

// Include session configuration if not already included
if (!function_exists('regenerateSessionIfNeeded')) {
    require_once __DIR__ . '/../config/session.php';
}

/**
 * Function to verify auth and retrieve the user data
 * This is a helper function used by API endpoints to check authentication
 * 
 * @return array|boolean User data if authenticated, false otherwise
 */
function verifyAuth() {
    // Ensure we have proper error handling for clean JSON responses
    ini_set('display_errors', 0);
    error_reporting(E_ALL);
    
    // Log authentication attempt
    error_log("Verifying authentication in auth.php");
    
    // Check if the user is logged in through PHP session
    if (isset($_SESSION['user_id']) && isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
        // User is authenticated via session
        error_log("User authenticated via PHP session");
        
        // Regenerate session ID periodically for security
        regenerateSessionIfNeeded();
        
        // Return user data from session
        return [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'] ?? 'User',
            'email' => $_SESSION['user_email'] ?? ''
        ];
    }
    
    // Check for remember-me token in cookies
    if (isset($_COOKIE['remember_token'])) {
        // Get database connection
        $conn = getDbConnection();
        
        // Get the token from the cookie
        $token = $_COOKIE['remember_token'];
        
        // Find matching token in database
        $stmt = $conn->prepare("SELECT user_id, token FROM auth_tokens WHERE expires_at > NOW()");
        $stmt->execute();
        $result = $stmt->get_result();
        
        $user_id = null;
        
        // Check each token (can't compare hashed values in SQL directly)
        while ($row = $result->fetch_assoc()) {
            // Verify the token against the stored hash
            if (password_verify($token, $row['token'])) {
                $user_id = $row['user_id'];
                break;
            }
        }
        
        // If we found a valid token
        if ($user_id) {
            // Get user data
            $userStmt = $conn->prepare("SELECT id, name, email FROM users WHERE id = ?");
            $userStmt->bind_param("i", $user_id);
            $userStmt->execute();
            $userResult = $userStmt->get_result();
            
            if ($userResult->num_rows === 1) {
                $user = $userResult->fetch_assoc();
                
                // Set session variables for future requests
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['user_name'] = $user['name'];
                $_SESSION['user_email'] = $user['email'];
                $_SESSION['logged_in'] = true;
                $_SESSION['login_time'] = time();
                $_SESSION['last_regeneration'] = time();
                
                // Regenerate session ID for security
                session_regenerate_id(true);
                
                error_log("User authenticated via remember-me token");
                
                // Close database connection
                $stmt->close();
                $userStmt->close();
                $conn->close();
                
                // Return user data
                return $user;
            }
        }
        
        // Close database connection
        $stmt->close();
        $conn->close();
    }
    
    // Check for Bearer token in Authorization header
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    $token = '';
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $token = $matches[1];
    }
    
    // If no token in header, check for token in query parameters
    if (empty($token) && isset($_GET['token'])) {
        $token = $_GET['token'];
    }
    
    // Connect to database to verify token if we found one
    if (!empty($token)) {
        // Get database connection
        require_once __DIR__ . '/../config/database.php';
        $conn = getDbConnection();
        
        // Verify token in database
        $stmt = $conn->prepare("SELECT user_id FROM auth_tokens WHERE token = ? AND expires_at > NOW()");
        $stmt->bind_param("s", $token);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 1) {
            $row = $result->fetch_assoc();
            $user_id = $row['user_id'];
            
            // Get user data
            $userStmt = $conn->prepare("SELECT id, name, email FROM users WHERE id = ?");
            $userStmt->bind_param("i", $user_id);
            $userStmt->execute();
            $userResult = $userStmt->get_result();
            
            if ($userResult->num_rows === 1) {
                $user = $userResult->fetch_assoc();
                
                // User authenticated via token
                error_log("User authenticated via token");
                
                // Set session variables for future requests
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['user_name'] = $user['name'];
                $_SESSION['user_email'] = $user['email'];
                $_SESSION['logged_in'] = true;
                $_SESSION['login_time'] = time();
                $_SESSION['last_regeneration'] = time();
                
                // Regenerate session ID for security
                session_regenerate_id(true);
                
                // Return user data
                return $user;
            }
        }
        
        // Close database connection
        $conn->close();
    }
    
    // If we get here, the user is not authenticated
    // Don't set any headers to avoid conflicts with CORS
    http_response_code(401); // Unauthorized
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required'
    ]);
    
    return false;
}

/**
 * Function to check if user is authenticated without exiting
 * 
 * @return boolean True if user is authenticated, false otherwise
 */
function isAuthenticated() {
    // Check if the user is logged in through PHP session
    if (isset($_SESSION['user_id']) && isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
        return true;
    }
    
    // Check for remember-me token in cookies
    if (isset($_COOKIE['remember_token'])) {
        // Get database connection
        $conn = getDbConnection();
        
        // Get the token from the cookie
        $token = $_COOKIE['remember_token'];
        
        // Find matching token in database
        $stmt = $conn->prepare("SELECT user_id, token FROM auth_tokens WHERE expires_at > NOW()");
        $stmt->execute();
        $result = $stmt->get_result();
        
        // Check each token (can't compare hashed values in SQL directly)
        while ($row = $result->fetch_assoc()) {
            // Verify the token against the stored hash
            if (password_verify($token, $row['token'])) {
                $stmt->close();
                $conn->close();
                return true;
            }
        }
        
        // Close database connection
        $stmt->close();
        $conn->close();
    }
    
    // Check for Bearer token in Authorization header
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    $apiToken = '';
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $apiToken = $matches[1];
    }
    
    // If no token in header, check for token in query parameters
    if (empty($apiToken) && isset($_GET['token'])) {
        $apiToken = $_GET['token'];
    }
    
    // Connect to database to verify token if we found one
    if (!empty($apiToken)) {
        // Get database connection
        $conn = getDbConnection();
        
        // Verify token in database
        $stmt = $conn->prepare("SELECT user_id FROM auth_tokens WHERE token = ? AND expires_at > NOW()");
        $stmt->bind_param("s", $apiToken);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 1) {
            $stmt->close();
            $conn->close();
            return true;
        }
        
        // Close database connection
        $stmt->close();
        $conn->close();
    }
    
    return false;
} 