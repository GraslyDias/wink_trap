<?php
/**
 * Session Verification API
 * This endpoint verifies if a user is authenticated via session
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Include configuration files
require_once '../config/database.php';
require_once '../config/session.php';
require_once '../utils/auth.php';

// Set content type to JSON
header('Content-Type: application/json');

// Debug - log session data
error_log('Verify.php - Session ID: ' . session_id());
error_log('Verify.php - Session data: ' . json_encode($_SESSION));
error_log('Verify.php - Request cookies: ' . json_encode($_COOKIE));

// Check if user is logged in (using the improved auth function)
if (isAuthenticated()) {
    // Get user data from session or database
    $user_id = $_SESSION['user_id'] ?? null;

    // Get user data from database for fresh information
    $conn = getDbConnection();
    $stmt = $conn->prepare("SELECT id, name, email, profile_pic FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        error_log('Verify.php - User not found in database: ' . $user_id);
        // User not found, clear session
        session_destroy();
        if (isset($_COOKIE['remember_token'])) {
            // Clear remember token cookie
            setcookie('remember_token', '', time() - 3600, '/', '', isset($_SERVER['HTTPS']), true);
        }
        http_response_code(401); // Unauthorized
        echo json_encode(['success' => false, 'message' => 'User not found']);
        $stmt->close();
        $conn->close();
        exit();
    }

    // Fetch user data
    $user = $result->fetch_assoc();
    error_log('Verify.php - User verified successfully: ' . $user['id'] . ' - ' . $user['email']);

    // Update session with latest user data
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    
    // Regenerate session if needed
    regenerateSessionIfNeeded();

    // Return success response with user data
    echo json_encode([
        'success' => true,
        'message' => 'User is authenticated',
        'data' => $user
    ]);

    // Close connection
    $stmt->close();
    $conn->close();
} else {
    error_log('Verify.php - Not authenticated: session=' . json_encode($_SESSION));
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit();
} 