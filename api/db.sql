-- Wink Trap Database Schema
-- This file contains the SQL instructions to create the database and tables for Wink Trap app

-- Create the database
DROP DATABASE IF EXISTS wink_trap;
CREATE DATABASE IF NOT EXISTS wink_trap;
USE wink_trap;

-- First drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS comment_replies;
DROP TABLE IF EXISTS comment_likes;
DROP TABLE IF EXISTS confession_comments;
DROP TABLE IF EXISTS confession_likes;
DROP TABLE IF EXISTS wall_confessions;
DROP TABLE IF EXISTS wall_crushes;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS relationships;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS private_chats;
DROP TABLE IF EXISTS wall_members;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS walls;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    profile_pic VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Authentication tokens table
CREATE TABLE IF NOT EXISTS auth_tokens (
    id INT(11) NOT NULL AUTO_INCREMENT,
    user_id INT(11) NOT NULL,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Walls table
CREATE TABLE IF NOT EXISTS walls (
    id INT(11) NOT NULL AUTO_INCREMENT,
    wall_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL,
    image_url VARCHAR(255) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Wall members table
CREATE TABLE IF NOT EXISTS wall_members (
    id INT(11) NOT NULL AUTO_INCREMENT,
    wall_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY wall_user (wall_id, user_id),
    FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Wall crushes table - to track user crushes
CREATE TABLE IF NOT EXISTS wall_crushes (
    id INT(11) NOT NULL AUTO_INCREMENT,
    wall_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,                  -- User who has the crush
    crush_on INT(11) NOT NULL,                 -- User who is the crush target
    created_at DATETIME NOT NULL,              -- When the crush was set
    PRIMARY KEY (id),
    UNIQUE KEY user_wall_crush (user_id, wall_id), -- One crush per user per wall
    FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (crush_on) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Wall confessions table - for wall confessions
CREATE TABLE IF NOT EXISTS wall_confessions (
    id INT(11) NOT NULL AUTO_INCREMENT,
    wall_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,                  -- Will be anonymous to other users
    text TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Confession likes table
CREATE TABLE IF NOT EXISTS confession_likes (
    id INT(11) NOT NULL AUTO_INCREMENT,
    confession_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY user_confession (user_id, confession_id),
    FOREIGN KEY (confession_id) REFERENCES wall_confessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Confession comments
CREATE TABLE IF NOT EXISTS confession_comments (
    id INT(11) NOT NULL AUTO_INCREMENT,
    confession_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (confession_id) REFERENCES wall_confessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comment likes
CREATE TABLE IF NOT EXISTS comment_likes (
    id INT(11) NOT NULL AUTO_INCREMENT,
    comment_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY user_comment (user_id, comment_id),
    FOREIGN KEY (comment_id) REFERENCES confession_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comment replies
CREATE TABLE IF NOT EXISTS comment_replies (
    id INT(11) NOT NULL AUTO_INCREMENT,
    comment_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (comment_id) REFERENCES confession_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Private chats - for mutual crushes
CREATE TABLE IF NOT EXISTS private_chats (
    id INT(11) NOT NULL AUTO_INCREMENT,
    match_id VARCHAR(100) NOT NULL UNIQUE, -- Format: match-user1-user2
    user1_id INT(11) NOT NULL,
    user2_id INT(11) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Private chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT(11) NOT NULL AUTO_INCREMENT,
    chat_id INT(11) NOT NULL,
    sender_id INT(11) NOT NULL,
    message TEXT NOT NULL,
    is_system_message BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (chat_id) REFERENCES private_chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Relationship statuses
CREATE TABLE IF NOT EXISTS relationships (
    id INT(11) NOT NULL AUTO_INCREMENT,
    chat_id INT(11) NOT NULL,
    status VARCHAR(50) NOT NULL,           -- e.g., "Just matched", "Dating casually"
    updated_at DATETIME NOT NULL,
    anniversary_checked BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (id),
    FOREIGN KEY (chat_id) REFERENCES private_chats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages table (general wall messages, not private chats)
CREATE TABLE IF NOT EXISTS messages (
    id INT(11) NOT NULL AUTO_INCREMENT,
    wall_id INT(11) NOT NULL,
    user_id INT(11) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id INT(11) NOT NULL AUTO_INCREMENT,
    user_id INT(11) NOT NULL UNIQUE,
    notifications BOOLEAN DEFAULT TRUE,
    dark_mode BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create test user (password: password123)
INSERT INTO users (name, email, password, created_at) VALUES 
('Test User', 'test@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NOW());

-- Create sample walls
INSERT INTO walls (wall_id, name, password, image_url, description, created_by, created_at) VALUES 
('wall1', 'Sunset Dreams', '123', 'https://images.unsplash.com/photo-1499988921418-b7df40ff03f9', 'A place to share your sunset dreams and thoughts', 1, NOW()),
('wall2', 'Night Owls', '123', 'https://images.unsplash.com/photo-1542332213-9b5a5a3fad35', 'For those who love the night and all its mysteries', 1, NOW()),
('wall3', 'Coffee Talks', '123', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', 'Coffee lovers unite! Share your coffee stories and crushes', 1, NOW());

-- Add test user as member of the sample walls
INSERT INTO wall_members (wall_id, user_id, joined_at) VALUES 
(1, 1, NOW()),
(2, 1, NOW()),
(3, 1, NOW());

-- Add a sample confession to test the confessions API
INSERT INTO wall_confessions (wall_id, user_id, text, created_at) VALUES
(1, 1, 'This is a test confession. I have a secret crush on someone in this wall!', NOW()); 