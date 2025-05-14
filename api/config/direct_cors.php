<?php
/**
 * Direct CORS Configuration
 * This file should be included at the very beginning of each API endpoint
 */

// Handle OPTIONS requests immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Set CORS headers for OPTIONS requests
    header("Access-Control-Allow-Origin: http://localhost:3000");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Max-Age: 86400");
    http_response_code(200);
    exit;
}

// Set CORS headers for regular requests
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 86400");

// Log CORS information for debugging
error_log('[CORS] Request method: ' . $_SERVER['REQUEST_METHOD'] . ', Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? 'Not set')); 