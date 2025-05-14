<?php
/**
 * User Login API
 * This endpoint handles user authentication for Wink Trap
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Create a custom error log for debugging
$logFile = __DIR__ . '/../../debug_login.log';
function debugLog($message) {
    global $logFile;
    file_put_contents($logFile, date('[Y-m-d H:i:s] ') . $message . PHP_EOL, FILE_APPEND);
}

// Log all errors to our custom log
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    debugLog("PHP Error ($errno): $errstr in $errfile on line $errline");
    return false; // Allow the standard error handler to run as well
});

// Start debugging with clear separation
debugLog('==================== NEW LOGIN REQUEST ====================');
debugLog('Request Method: ' . ($_SERVER['REQUEST_METHOD'] ?? 'Not set'));
debugLog('Request URI: ' . ($_SERVER['REQUEST_URI'] ?? 'Not set'));

// Error reporting for logs only, not for display
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Set content type to JSON
header('Content-Type: application/json');

try {
    // Include session configuration
    debugLog('Loading session configuration');
    require_once '../config/session.php';
    debugLog('Session configuration loaded');
    
    // Include other configuration files
    debugLog('Loading database configuration');
    require_once '../config/database.php';
    debugLog('Database configuration loaded');
    
    // Debug log for troubleshooting
    debugLog('Login API called. Session status: ' . session_status());
    debugLog('Session ID: ' . session_id());
    
    $headers = array();
    foreach ($_SERVER as $key => $value) {
        if (substr($key, 0, 5) == 'HTTP_') {
            $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))))] = $value;
        }
    }
    debugLog('Request headers: ' . json_encode($headers));
    
    // Only allow POST requests for login
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405); // Method Not Allowed
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        debugLog('Method not allowed: ' . $_SERVER['REQUEST_METHOD']);
        exit();
    }
    
    // Get database connection
    debugLog('Getting database connection');
    $conn = getDbConnection();
    debugLog('Database connection successful');
    
    // Get POST data
    $inputData = file_get_contents('php://input');
    debugLog('Raw input data: ' . $inputData);
    
    $data = json_decode($inputData, true);
    debugLog('Parsed JSON data: ' . json_encode($data));
    
    // If form data is submitted instead of JSON
    if (empty($data)) {
        debugLog('JSON data empty, checking POST data');
        $data = $_POST;
        debugLog('Using POST data instead: ' . json_encode($_POST));
    }
    
    // Validate required fields
    if (empty($data['email']) || empty($data['password'])) {
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Please provide email and password']);
        debugLog('Missing credentials. Email: ' . (isset($data['email']) ? 'provided' : 'missing') . ', Password: ' . (isset($data['password']) ? 'provided' : 'missing'));
        exit();
    }
    
    // Sanitize input data
    $email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
    debugLog('Sanitized email: ' . $email);
    $password = $data['password']; // No need to sanitize password as it will be verified against hash
    
    // Check for remember me option (defaults to true for persistent login)
    $rememberMe = isset($data['remember_me']) ? (bool)$data['remember_me'] : true;
    debugLog('Remember me: ' . ($rememberMe ? 'true' : 'false'));
    
    // Get user from database
    debugLog('Preparing SQL query to get user');
    $stmt = $conn->prepare("SELECT id, name, email, password FROM users WHERE email = ?");
    if (!$stmt) {
        throw new Exception('Failed to prepare statement: ' . $conn->error);
    }
    
    debugLog('Binding parameters');
    $stmt->bind_param("s", $email);
    
    debugLog('Executing query');
    if (!$stmt->execute()) {
        throw new Exception('Execute failed: ' . $stmt->error);
    }
    
    debugLog('Getting result');
    $result = $stmt->get_result();
    debugLog('Query returned ' . $result->num_rows . ' rows');
    
    if ($result->num_rows === 0) {
        http_response_code(401); // Unauthorized
        echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
        debugLog('User not found for email: ' . $email);
        $stmt->close();
        $conn->close();
        exit();
    }
    
    // Fetch user data
    debugLog('Fetching user data');
    $user = $result->fetch_assoc();
    debugLog('User found with ID: ' . $user['id']);
    
    // Verify password
    debugLog('Verifying password');
    if (!password_verify($password, $user['password'])) {
        http_response_code(401); // Unauthorized
        echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
        debugLog('Password verification failed for user: ' . $user['id']);
        $stmt->close();
        $conn->close();
        exit();
    }
    
    // Password verified, continue with login
    debugLog('Password verified successfully');
    
    // Start the session if not already started
    if (session_status() !== PHP_SESSION_ACTIVE) {
        debugLog('Starting session');
        session_start();
        debugLog('Session started, ID: ' . session_id());
    } else {
        debugLog('Session already active, ID: ' . session_id());
    }
    
    // Regenerate session ID for security
    debugLog('Regenerating session ID');
    session_regenerate_id(true);
    debugLog('New session ID: ' . session_id());
    
    // Login successful, store user info in session
    debugLog('Setting session data for user ID: ' . $user['id']);
    
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['logged_in'] = true;
    $_SESSION['login_time'] = time();
    $_SESSION['last_regeneration'] = time();
    
    debugLog('Session data set: ' . json_encode($_SESSION));
    
    // If remember me is enabled, extend session lifetime
    if ($rememberMe) {
        debugLog('Setting up remember-me functionality');
        
        try {
            // Update last login time in database
            $updateStmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            if (!$updateStmt) {
                throw new Exception('Failed to prepare update statement: ' . $conn->error);
            }
            
            $updateStmt->bind_param("i", $user['id']);
            if (!$updateStmt->execute()) {
                throw new Exception('Failed to update last login time: ' . $updateStmt->error);
            } else {
                debugLog('Last login time updated');
            }
            $updateStmt->close();
            
            // Store a persistent login token in the database
            debugLog('Generating secure token');
            $token = bin2hex(random_bytes(32)); // Generate a secure random token
            $tokenHash = password_hash($token, PASSWORD_DEFAULT);
            $expiryDays = 30; // Token valid for 30 days
            
            // Check if auth_tokens table exists
            $checkTable = $conn->query("SHOW TABLES LIKE 'auth_tokens'");
            if ($checkTable->num_rows == 0) {
                debugLog('Creating auth_tokens table as it does not exist');
                // Create the table if it doesn't exist
                $createTable = "CREATE TABLE auth_tokens (
                    id INT(11) NOT NULL AUTO_INCREMENT,
                    user_id INT(11) NOT NULL,
                    token VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    PRIMARY KEY (id),
                    KEY user_id (user_id)
                )";
                if (!$conn->query($createTable)) {
                    throw new Exception('Failed to create auth_tokens table: ' . $conn->error);
                }
                debugLog('auth_tokens table created successfully');
            }
            
            // Store the token in the database
            debugLog('Storing token in database');
            $tokenStmt = $conn->prepare("INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))");
            if (!$tokenStmt) {
                throw new Exception('Failed to prepare token statement: ' . $conn->error);
            }
            
            $tokenStmt->bind_param("isi", $user['id'], $tokenHash, $expiryDays);
            if (!$tokenStmt->execute()) {
                throw new Exception('Failed to store token: ' . $tokenStmt->error);
            }
            debugLog('Token stored in database');
            $tokenStmt->close();
            
            // Set a persistent cookie with the token (30 days)
            $cookieLifetime = 30 * 24 * 60 * 60; // 30 days in seconds
            debugLog('Setting remember-me cookie');
            
            $cookieResult = setcookie(
                'remember_token',
                $token,
                [
                    'expires' => time() + $cookieLifetime,
                    'path' => '/',
                    'domain' => '',
                    'secure' => isset($_SERVER['HTTPS']),
                    'httponly' => true,
                    'samesite' => 'Lax'
                ]
            );
            
            debugLog('Cookie set result: ' . ($cookieResult ? 'success' : 'failed'));
        } catch (Exception $e) {
            debugLog('Error in remember-me processing: ' . $e->getMessage());
            // Continue login process even if remember-me fails
        }
    }
    
    // Debug log
    debugLog('Login successful for user ID: ' . $user['id']);
    
    // Log cookie information
    if (isset($_COOKIE[session_name()])) {
        debugLog('Session cookie is set: ' . session_name() . '=' . $_COOKIE[session_name()]);
    } else {
        debugLog('WARNING: Session cookie is NOT set!');
    }
    
    // Remove password from user data before sending response
    unset($user['password']);
    
    // Return success response with user data
    debugLog('Preparing success response');
    http_response_code(200);
    
    $responseData = [
        'success' => true, 
        'message' => 'Login successful',
        'user' => $user,
        'session_id' => session_id(),
        'php_session_name' => session_name(),
        'remember_me' => $rememberMe
    ];
    
    debugLog('Response data prepared: ' . json_encode($responseData));
    echo json_encode($responseData);
    debugLog('Response sent');
    
    // Close connection
    $stmt->close();
    $conn->close();
    debugLog('Database connection closed');
    debugLog('==================== LOGIN REQUEST COMPLETE ====================');

} catch (Exception $e) {
    // Log the error
    debugLog('CRITICAL ERROR: ' . $e->getMessage());
    debugLog('Stack trace: ' . $e->getTraceAsString());
    
    // Return error response
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'An error occurred during login. Please try again later.',
        'error' => $e->getMessage() // This helps with debugging but remove in production
    ]);
    
    // Close database connection if it exists
    if (isset($conn)) {
        $conn->close();
        debugLog('Database connection closed after error');
    }
    
    if (isset($stmt)) {
        $stmt->close();
        debugLog('Statement closed after error');
    }
    
    debugLog('==================== LOGIN REQUEST FAILED ====================');
} 