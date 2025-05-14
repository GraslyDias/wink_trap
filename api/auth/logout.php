<?php
/**
 * User Logout API
 * This endpoint handles logging users out
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../config/session.php';

// Error reporting for logs only, not for display
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Check if user is logged in
if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
    // User is not logged in
    http_response_code(200); // Still return success even if not logged in
    echo json_encode(['success' => true, 'message' => 'Already logged out']);
    exit();
}

// If remember token exists, delete it from database
if (isset($_COOKIE['remember_token'])) {
    $token = $_COOKIE['remember_token'];
    $conn = getDbConnection();
    
    // Delete tokens for this user
    $stmt = $conn->prepare("DELETE FROM auth_tokens WHERE user_id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $stmt->close();
    $conn->close();
    
    // Clear the remember token cookie
    setcookie(
        'remember_token',
        '',
        [
            'expires' => time() - 3600,
            'path' => '/',
            'domain' => '',
            'secure' => isset($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax'
        ]
    );
    
    error_log('Logout: Cleared remember token for user ID: ' . $_SESSION['user_id']);
}

// Clear all session variables
$_SESSION = array();

// If a session cookie is used, delete it
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        [
            'expires' => time() - 3600,
            'path' => $params["path"],
            'domain' => $params["domain"],
            'secure' => $params["secure"],
            'httponly' => $params["httponly"],
            'samesite' => 'Lax'
        ]
    );
}

// Destroy the session
session_destroy();

// Return success response
http_response_code(200);
echo json_encode(['success' => true, 'message' => 'Logout successful']); 