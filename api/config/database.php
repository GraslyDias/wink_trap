<?php
/**
 * Database Connection Configuration
 * This file contains the database connection parameters for the Wink Trap application
 */

// Database credentials
define('DB_HOST', 'localhost');     // Database host
define('DB_NAME', 'wink_trap');     // Database name
define('DB_USER', 'root');          // Database username - change in production
define('DB_PASS', 'Imesh2001@');              // Database password - change in production

// Create database connection
function getDbConnection() {
    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        
        // Check connection
        if ($conn->connect_error) {
            error_log("Database connection failed: " . $conn->connect_error);
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed']);
            exit();
        }
        
        return $conn;
    } catch (Exception $e) {
        error_log("Database connection exception: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit();
    }
}

// Sanitize input data to prevent SQL injection
function sanitizeInput($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data);
    return $data;
} 