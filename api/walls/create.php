<?php
/**
 * Create Wall API
 * This endpoint handles creating new walls
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Set a custom error log file
$logFile = __DIR__ . '/../../debug.log';

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

// Start session
session_start();

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Enable error reporting for debugging
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Only allow POST requests for wall creation
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    debugLog('ERROR: Method not allowed: ' . $_SERVER['REQUEST_METHOD']);
    exit();
}

// Handle case where content type might include boundary
$contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
debugLog('Raw Content-Type: ' . $contentType);

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
    
    // Check if Content-Type contains multipart/form-data (it might include boundary info)
    debugLog('Parsing request data');
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
    if (empty($data['name'])) {
        debugLog('ERROR: Missing wall name');
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please provide wall name']);
        exit();
    }
    
    if (empty($data['password'])) {
        debugLog('ERROR: Missing wall password');
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please provide wall password']);
        exit();
    }

    // Sanitize input data
    $wallName = sanitizeInput($data['name']);
    $wallPassword = sanitizeInput($data['password']);
    $wallDescription = isset($data['description']) ? sanitizeInput($data['description']) : '';
    debugLog('Sanitized data - Name: ' . $wallName . ', Description: ' . ($wallDescription ?: 'not provided'));
    
    // Use provided Wall ID or generate a unique one
    $wallId = !empty($data['wallId']) ? sanitizeInput($data['wallId']) : generateUniqueWallId($conn);
    debugLog('Using Wall ID: ' . $wallId);
    
    // Default image URL in case upload fails or no image is provided
    $imageUrl = 'https://images.unsplash.com/photo-1522441815192-d9f04eb0615c';
    
    // Handle image upload
    debugLog('Checking for image upload');
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        debugLog('Image file received: ' . $_FILES['image']['name']);
        $uploadDir = __DIR__ . '/../uploads/walls/'; // Updated path to use api/uploads/walls
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
            $serverUrl = getServerUrl();
            // Use a consistent path format that points to api/uploads
            $relativePath = '/api/uploads/walls/' . $fileName;
            $imageUrl = $serverUrl . $relativePath;
            debugLog('Image URL set to: ' . $imageUrl);
        } else {
            // Log error but continue with default image
            $uploadError = error_get_last();
            debugLog('ERROR: Failed to upload image. PHP error: ' . ($uploadError ? $uploadError['message'] : 'Unknown error'));
            
            // Additional upload error details
            $phpFileUploadErrors = [
                0 => 'There is no error, the file uploaded with success',
                1 => 'The uploaded file exceeds the upload_max_filesize directive in php.ini',
                2 => 'The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form',
                3 => 'The uploaded file was only partially uploaded',
                4 => 'No file was uploaded',
                6 => 'Missing a temporary folder',
                7 => 'Failed to write file to disk',
                8 => 'A PHP extension stopped the file upload',
            ];
            
            $errorCode = $_FILES['image']['error'];
            debugLog('PHP File Upload Error Code: ' . $errorCode . ' - ' . $phpFileUploadErrors[$errorCode]);
            // Check if temp file exists
            if (!file_exists($_FILES['image']['tmp_name'])) {
                debugLog('ERROR: Temporary file does not exist: ' . $_FILES['image']['tmp_name']);
            }
        }
    } else if (isset($_FILES['image'])) {
        $errorCode = $_FILES['image']['error'];
        $phpFileUploadErrors = [
            0 => 'There is no error, the file uploaded with success',
            1 => 'The uploaded file exceeds the upload_max_filesize directive in php.ini',
            2 => 'The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form',
            3 => 'The uploaded file was only partially uploaded',
            4 => 'No file was uploaded',
            6 => 'Missing a temporary folder',
            7 => 'Failed to write file to disk',
            8 => 'A PHP extension stopped the file upload',
        ];
        debugLog('Image upload issue - Error code: ' . $errorCode . ' - ' . $phpFileUploadErrors[$errorCode]);
    } else {
        debugLog('No image file was submitted');
    }

    // Log wall creation details
    debugLog('Creating wall in database. Name: ' . $wallName . ', ID: ' . $wallId);

    // Check if wall ID already exists
    debugLog('Checking if wall ID already exists');
    $stmt = $conn->prepare("SELECT id FROM walls WHERE wall_id = ?");
    $stmt->bind_param("s", $wallId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        debugLog('ERROR: Wall ID already exists: ' . $wallId);
        http_response_code(409); // Conflict
        echo json_encode(['success' => false, 'message' => 'Wall ID already exists. Please choose a different one.']);
        $stmt->close();
        $conn->close();
        exit();
    }

    // Create wall in database
    try {
        debugLog('Inserting wall into database');
        $stmt = $conn->prepare("INSERT INTO walls (wall_id, name, password, image_url, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $stmt->bind_param("sssssi", $wallId, $wallName, $wallPassword, $imageUrl, $wallDescription, $user['id']);

        if ($stmt->execute()) {
            $wallDbId = $conn->insert_id;
            debugLog('Wall inserted successfully with database ID: ' . $wallDbId);
            
            // Add creator as a member
            debugLog('Adding creator as a wall member');
            $memberStmt = $conn->prepare("INSERT INTO wall_members (wall_id, user_id, joined_at) VALUES (?, ?, NOW())");
            $memberStmt->bind_param("ii", $wallDbId, $user['id']);
            
            if ($memberStmt->execute()) {
                debugLog('Creator added as wall member successfully');
            } else {
                debugLog('ERROR: Failed to add creator as wall member: ' . $memberStmt->error);
            }
            $memberStmt->close();
            
            // Return success response
            debugLog('Returning success response');
            http_response_code(201); // Created
            echo json_encode([
                'success' => true, 
                'message' => 'Wall created successfully',
                'wall' => [
                    'id' => $wallId, // Send the custom wall ID as the ID
                    'wall_id' => $wallId,
                    'name' => $wallName,
                    'description' => $wallDescription,
                    'image_url' => $imageUrl,
                    'member_count' => 1,
                    'is_joined' => true
                ]
            ]);
            debugLog('Wall creation completed successfully');
        } else {
            throw new Exception($conn->error);
        }
    } catch (Exception $e) {
        debugLog('ERROR: Failed to create wall in database: ' . $e->getMessage());
        http_response_code(500); // Internal Server Error
        echo json_encode(['success' => false, 'message' => 'Failed to create wall: ' . $e->getMessage()]);
    }

    // Close connection
    $stmt->close();
    $conn->close();
    debugLog('Database connection closed');
    
} catch (Exception $e) {
    debugLog('CRITICAL ERROR: Unexpected exception: ' . $e->getMessage());
    debugLog('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}

/**
 * Generate a unique wall ID
 * @param mysqli $conn Database connection
 * @return string Unique wall ID
 */
function generateUniqueWallId($conn) {
    // Generate a random string
    $characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $randomString = '';
    
    for ($i = 0; $i < 8; $i++) {
        $randomString .= $characters[rand(0, strlen($characters) - 1)];
    }
    
    // Check if the ID already exists
    $stmt = $conn->prepare("SELECT id FROM walls WHERE wall_id = ?");
    $stmt->bind_param("s", $randomString);
    $stmt->execute();
    $result = $stmt->get_result();
    
    // If ID exists, generate a new one recursively
    if ($result->num_rows > 0) {
        $stmt->close();
        return generateUniqueWallId($conn);
    }
    
    $stmt->close();
    return $randomString;
}

/**
 * Get the server base URL
 * @return string Server URL
 */
function getServerUrl() {
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    return $protocol . '://' . $host . '/wink_trap';
} 