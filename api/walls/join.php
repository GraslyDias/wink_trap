<?php
/**
 * Join Wall API
 * This endpoint handles joining an existing wall
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Error reporting for logs only, not for display
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Only allow POST requests for joining walls
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Verify user is authenticated
$user = verifyAuth();
if (!$user) {
    exit(); // Error response is handled in verifyAuth()
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
if (empty($data['wallId']) || empty($data['password'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Please provide wall ID and password']);
    exit();
}

// Sanitize input data
$wallId = sanitizeInput($data['wallId']);
$password = sanitizeInput($data['password']);

// Find wall by ID
$stmt = $conn->prepare("SELECT id, name, password, image_url FROM walls WHERE wall_id = ?");
$stmt->bind_param("s", $wallId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404); // Not Found
    echo json_encode(['success' => false, 'message' => 'Wall not found']);
    $stmt->close();
    $conn->close();
    exit();
}

$wall = $result->fetch_assoc();
$stmt->close();

// Verify wall password
if ($wall['password'] !== $password) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'Incorrect password']);
    $conn->close();
    exit();
}

// Check if user already joined this wall
$stmt = $conn->prepare("SELECT id FROM wall_members WHERE wall_id = ? AND user_id = ?");
$stmt->bind_param("ii", $wall['id'], $user['id']);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    http_response_code(409); // Conflict
    echo json_encode(['success' => false, 'message' => 'You are already a member of this wall']);
    $stmt->close();
    $conn->close();
    exit();
}
$stmt->close();

// Add user as a member of the wall
$stmt = $conn->prepare("INSERT INTO wall_members (wall_id, user_id, joined_at) VALUES (?, ?, NOW())");
$stmt->bind_param("ii", $wall['id'], $user['id']);

if ($stmt->execute()) {
    // Get current member count
    $countStmt = $conn->prepare("SELECT COUNT(*) as member_count FROM wall_members WHERE wall_id = ?");
    $countStmt->bind_param("i", $wall['id']);
    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $memberCount = $countResult->fetch_assoc()['member_count'];
    $countStmt->close();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Successfully joined wall',
        'wall' => [
            'id' => $wall['id'],
            'name' => $wall['name'],
            'image' => $wall['image_url'],
            'members' => $memberCount,
            'isJoined' => true
        ]
    ]);
} else {
    http_response_code(500); // Internal Server Error
    echo json_encode(['success' => false, 'message' => 'Failed to join wall: ' . $conn->error]);
}

// Close connection
$stmt->close();
$conn->close(); 