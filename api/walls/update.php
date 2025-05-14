<?php
/**
 * Update Wall API
 * This endpoint handles updating existing walls
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Set a custom error log file
$logFile = __DIR__ . '/../../debug_wall_update.log';

// Custom logging function
function debugLog($message) {
    global $logFile;
    file_put_contents($logFile, date('[Y-m-d H:i:s] ') . $message . PHP_EOL, FILE_APPEND);
}

// Log errors to our custom log
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    debugLog("PHP Error ($errno): $errstr in $errfile on line $errline");
    return false; // Allow standard error handler to run as well
});

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Enable error reporting for debugging
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Only allow POST requests for wall updates
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    debugLog('ERROR: Method not allowed: ' . $_SERVER['REQUEST_METHOD']);
    exit();
}

try {
    // Verify user is authenticated
    debugLog('Starting user authentication check');
    $user = verifyAuth();
    if (!$user) {
        debugLog('ERROR: Authentication failed');
        exit(); // Error response is handled in verifyAuth()
    }

    // Log authenticated user
    debugLog('Authentication successful. User ID: ' . $user['id'] . ', Email: ' . $user['email']);
    
    // Get database connection
    debugLog('Getting database connection');
    $conn = getDbConnection();
    debugLog('Database connection successful');
    
    // Get POST data
    $data = [];
    
    // Check if Content-Type contains multipart/form-data
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    debugLog('Raw Content-Type: ' . $contentType);
    
    if (strpos($contentType, 'multipart/form-data') !== false) {
        // Form data with file upload
        $data = $_POST;
        debugLog('Processing as multipart/form-data');
        debugLog('POST data after processing: ' . print_r($_POST, true));
    } elseif (strpos($contentType, 'application/json') !== false) {
        // JSON data
        $jsonData = file_get_contents('php://input');
        debugLog('Raw JSON data: ' . $jsonData);
        $data = json_decode($jsonData, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            debugLog('ERROR: JSON parse error: ' . json_last_error_msg());
        }
    } else {
        // Regular form data
        $data = $_POST;
        debugLog('Processing as regular form data: ' . print_r($_POST, true));
    }
    
    // Log parsed data
    debugLog('Parsed data: ' . print_r($data, true));

    // Validate required fields
    if (empty($data['wall_id'])) {
        debugLog('ERROR: Missing wall ID');
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please provide wall ID']);
        exit();
    }
    
    $wallId = sanitizeInput($data['wall_id']);
    $name = isset($data['name']) ? sanitizeInput($data['name']) : null;
    $description = isset($data['description']) ? sanitizeInput($data['description']) : null;
    
    debugLog('Sanitized data - Wall ID: ' . $wallId . ', Name: ' . ($name ?: 'not provided') . ', Description: ' . ($description ?: 'not provided'));
    
    // Check if wall exists and if the user is the creator
    debugLog('Checking if wall exists and if user is the creator');
    $stmt = $conn->prepare("SELECT w.id, w.name, w.image_url, w.created_by FROM walls w WHERE w.wall_id = ?");
    $stmt->bind_param("s", $wallId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        debugLog('ERROR: Wall not found with ID: ' . $wallId);
        http_response_code(404); // Not Found
        echo json_encode(['success' => false, 'message' => 'Wall not found']);
        $stmt->close();
        $conn->close();
        exit();
    }
    
    $wall = $result->fetch_assoc();
    $stmt->close();
    
    // Check if user is the creator of the wall
    if ($wall['created_by'] != $user['id']) {
        debugLog('ERROR: User is not the creator of the wall. Wall creator: ' . $wall['created_by'] . ', User: ' . $user['id']);
        http_response_code(403); // Forbidden
        echo json_encode(['success' => false, 'message' => 'You do not have permission to edit this wall']);
        $conn->close();
        exit();
    }
    
    // Prepare update query parts
    $updateFields = [];
    $queryParams = [];
    $paramTypes = "";
    
    // Add name to update if provided
    if (!empty($name)) {
        $updateFields[] = "name = ?";
        $queryParams[] = $name;
        $paramTypes .= "s";
        debugLog('Adding name to update fields: ' . $name);
    }
    
    // Add description to update if provided
    if ($description !== null) {
        $updateFields[] = "description = ?";
        $queryParams[] = $description;
        $paramTypes .= "s";
        debugLog('Adding description to update fields: ' . $description);
    }
    
    // Handle image upload
    $imageUrl = $wall['image_url']; // Default to existing image
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        debugLog('Image file received: ' . $_FILES['image']['name']);
        $uploadDir = __DIR__ . '/../uploads/walls/'; // Use api/uploads/walls directory
        debugLog('Upload directory: ' . $uploadDir);
        
        // Create directory if it doesn't exist
        if (!file_exists($uploadDir)) {
            debugLog('Upload directory does not exist, creating it now');
            if (!mkdir($uploadDir, 0755, true)) {
                debugLog('ERROR: Failed to create upload directory: ' . $uploadDir);
                $uploadError = error_get_last();
                debugLog('PHP error: ' . ($uploadError ? $uploadError['message'] : 'Unknown error'));
            } else {
                debugLog('Upload directory created successfully');
            }
        }
        
        // Check if directory is writable
        if (!is_writable($uploadDir)) {
            debugLog('ERROR: Upload directory is not writable: ' . $uploadDir);
        } else {
            debugLog('Upload directory is writable');
        }
        
        // Generate unique filename
        $fileExtension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
        $fileName = 'wall_' . time() . '_' . uniqid() . '.' . $fileExtension;
        $targetFile = $uploadDir . $fileName;
        
        // Log upload details
        debugLog('Image upload details: Name=' . $_FILES['image']['name'] . ', Type=' . $_FILES['image']['type'] . ', Size=' . $_FILES['image']['size']);
        debugLog('Target file path: ' . $targetFile);
        
        // Validate image file
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
        $maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!in_array($_FILES['image']['type'], $allowedTypes)) {
            $errorMsg = 'Invalid file type: ' . $_FILES['image']['type'] . '. Only JPG, PNG and GIF files are allowed.';
            debugLog('ERROR: ' . $errorMsg);
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $errorMsg]);
            exit();
        }
        
        if ($_FILES['image']['size'] > $maxSize) {
            debugLog('ERROR: File size exceeds limit: ' . $_FILES['image']['size'] . ' bytes (max: ' . $maxSize . ' bytes)');
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'File size exceeds limit. Maximum 5MB allowed.']);
            exit();
        }
        
        // Move uploaded file to target directory
        debugLog('Attempting to move uploaded file to: ' . $targetFile);
        if (move_uploaded_file($_FILES['image']['tmp_name'], $targetFile)) {
            debugLog('File uploaded successfully to: ' . $targetFile);
            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $serverUrl = $protocol . '://' . $host . '/wink_trap';
            $relativePath = '/api/uploads/walls/' . $fileName;
            $imageUrl = $serverUrl . $relativePath;
            debugLog('Image URL set to: ' . $imageUrl);
            
            // Add to update fields
            $updateFields[] = "image_url = ?";
            $queryParams[] = $imageUrl;
            $paramTypes .= "s";
        } else {
            $uploadError = error_get_last();
            debugLog('ERROR: Failed to upload image. PHP error: ' . ($uploadError ? $uploadError['message'] : 'Unknown error'));
        }
    }
    
    // If no fields to update, return success with existing data
    if (empty($updateFields)) {
        debugLog('No fields to update');
        echo json_encode([
            'success' => true,
            'message' => 'No changes to update',
            'wall' => [
                'id' => $wallId,
                'name' => $wall['name'],
                'image_url' => $wall['image_url']
            ]
        ]);
        $conn->close();
        exit();
    }
    
    // Build and execute the update query
    $query = "UPDATE walls SET " . implode(", ", $updateFields) . " WHERE wall_id = ?";
    $queryParams[] = $wallId;
    $paramTypes .= "s";
    
    debugLog('Update query: ' . $query);
    debugLog('Param types: ' . $paramTypes);
    
    // Prepare statement
    $stmt = $conn->prepare($query);
    if (!$stmt) {
        debugLog('ERROR: Failed to prepare statement: ' . $conn->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error preparing update']);
        $conn->close();
        exit();
    }
    
    // Bind parameters
    if (!$stmt->bind_param($paramTypes, ...$queryParams)) {
        debugLog('ERROR: Failed to bind parameters: ' . $stmt->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error binding parameters']);
        $stmt->close();
        $conn->close();
        exit();
    }
    
    // Execute update
    if (!$stmt->execute()) {
        debugLog('ERROR: Failed to execute update: ' . $stmt->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error executing update']);
        $stmt->close();
        $conn->close();
        exit();
    }
    
    debugLog('Wall updated successfully');
    $stmt->close();
    
    // Get updated wall data
    $stmt = $conn->prepare("SELECT w.id, w.wall_id, w.name, w.description, w.image_url, (SELECT COUNT(*) FROM wall_members WHERE wall_id = w.id) as member_count FROM walls w WHERE w.wall_id = ?");
    $stmt->bind_param("s", $wallId);
    $stmt->execute();
    $result = $stmt->get_result();
    $updatedWall = $result->fetch_assoc();
    $stmt->close();
    
    // Return success response with updated wall data
    echo json_encode([
        'success' => true,
        'message' => 'Wall updated successfully',
        'wall' => [
            'id' => $updatedWall['wall_id'],
            'name' => $updatedWall['name'],
            'description' => $updatedWall['description'],
            'image' => $updatedWall['image_url'],
            'members' => $updatedWall['member_count'],
            'isJoined' => true
        ]
    ]);
    
    debugLog('Update response sent successfully');

} catch (Exception $e) {
    debugLog('CRITICAL ERROR: ' . $e->getMessage());
    debugLog('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}

// Close connection
if (isset($conn)) {
    $conn->close();
    debugLog('Database connection closed');
} 