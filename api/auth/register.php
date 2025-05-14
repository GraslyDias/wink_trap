<?php
/**
 * User Registration API
 * This endpoint handles new user registration for Wink Trap
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

// Only allow POST requests for registration
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Get database connection
$conn = getDbConnection();

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// If form data is submitted instead of JSON
if (empty($data)) {
    $data = $_POST;
}

// Validate required fields
if (empty($data['name']) || empty($data['email']) || empty($data['password'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Please provide name, email and password']);
    exit();
}

// Sanitize input data
$name = sanitizeInput($data['name']);
$email = sanitizeInput($data['email']);
$password = $data['password']; // Will be hashed, no need to sanitize

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit();
}

// Validate password length
if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
    exit();
}

// Check if email already exists
$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    http_response_code(409); // Conflict
    echo json_encode(['success' => false, 'message' => 'Email is already registered']);
    $stmt->close();
    $conn->close();
    exit();
}

// Hash the password
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Create user in database
$stmt = $conn->prepare("INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, NOW())");
$stmt->bind_param("sss", $name, $email, $hashedPassword);

if ($stmt->execute()) {
    $userId = $conn->insert_id;
    
    // Generate auth token (simple for demo purposes - use JWT in production)
    $authToken = bin2hex(random_bytes(32));
    
    // Store auth token in database
    $tokenStmt = $conn->prepare("INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))");
    $tokenStmt->bind_param("is", $userId, $authToken);
    $tokenStmt->execute();
    $tokenStmt->close();
    
    // Return success response with user data (excluding password)
    http_response_code(201); // Created
    echo json_encode([
        'success' => true, 
        'message' => 'Registration successful',
        'user' => [
            'id' => $userId,
            'name' => $name,
            'email' => $email
        ],
        'token' => $authToken
    ]);
} else {
    http_response_code(500); // Internal Server Error
    echo json_encode(['success' => false, 'message' => 'Registration failed: ' . $conn->error]);
}

// Close connection
$stmt->close();
$conn->close(); 