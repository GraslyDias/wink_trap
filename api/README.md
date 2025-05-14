# Wink Trap API

Backend API for the Wink Trap application, a platform for creating and joining private conversation spaces called "Whispering Walls".

## Setup Instructions

### Requirements
- PHP 7.4 or higher
- MySQL 5.7 or higher
- Apache/Nginx web server

### Installation

1. **Clone the repository**
   ```
   git clone https://github.com/yourusername/wink_trap.git
   cd wink_trap
   ```

2. **Set up the database**
   - Create a MySQL database named `wink_trap`
   - Import the database schema from `db.sql`:
   ```
   mysql -u username -p wink_trap < db.sql
   ```

3. **Configure the database connection**
   - Open `api/config/database.php`
   - Update the database credentials:
   ```php
   define('DB_HOST', 'localhost');     // Your database host
   define('DB_NAME', 'wink_trap');     // Database name
   define('DB_USER', 'your_username'); // Your database username
   define('DB_PASS', 'your_password'); // Your database password
   ```

4. **Configure web server**
   - Point your web server to the project directory
   - Ensure PHP has write permissions for uploading files
   - Configure CORS if your frontend is on a different domain/port

### Development Setup

For local development, you can use PHP's built-in web server:

```
cd /path/to/wink_trap
php -S localhost:8000
```

The API will be available at `http://localhost:8000/api/`.

## API Documentation

### Authentication Endpoints

#### Register a new user
- **URL**: `/api/auth/register.php`
- **Method**: `POST`
- **Parameters**:
  - `name`: User's full name
  - `email`: User's email (must be unique)
  - `password`: User's password (min 6 characters)
- **Response**: User data and authentication token

#### Login
- **URL**: `/api/auth/login.php`
- **Method**: `POST`
- **Parameters**:
  - `email`: User's email
  - `password`: User's password
- **Response**: User data and authentication token

#### Logout
- **URL**: `/api/auth/logout.php`
- **Method**: `POST`
- **Parameters**:
  - `token` (optional): Auth token to invalidate
- **Headers**:
  - `Authorization: Bearer <token>` (alternative to token parameter)
- **Response**: Success message

#### Verify Token
- **URL**: `/api/auth/verify.php`
- **Method**: `GET`
- **Parameters**:
  - `token` (optional): Auth token to verify
- **Headers**:
  - `Authorization: Bearer <token>` (alternative to token parameter)
- **Response**: User data if token is valid

### Whispering Walls Endpoints

#### Create a new wall
- **URL**: `/api/walls/create.php`
- **Method**: `POST`
- **Parameters**:
  - `name`: Wall name
  - `password`: Wall password
  - `wallId`: Unique ID for the wall
  - `image` (optional): URL for wall image
- **Authentication**: Required
- **Response**: Wall data

#### Join a wall
- **URL**: `/api/walls/join.php`
- **Method**: `POST`
- **Parameters**:
  - `wallId`: Wall ID to join
  - `password`: Wall password
- **Authentication**: Required
- **Response**: Wall data

#### List joined walls
- **URL**: `/api/walls/list.php`
- **Method**: `GET`
- **Parameters**: None
- **Authentication**: Required
- **Response**: Array of walls the user has joined

### User Profile Endpoints

#### Get user profile
- **URL**: `/api/users/profile.php`
- **Method**: `GET`
- **Parameters**: None
- **Authentication**: Required
- **Response**: User profile data

#### Update user profile
- **URL**: `/api/users/profile.php`
- **Method**: `POST/PUT`
- **Parameters**:
  - `name` (optional): New user name
  - `profilePic` (optional): New profile picture URL
- **Authentication**: Required
- **Response**: Updated user profile data

## Security Notes

- All passwords are hashed using PHP's `password_hash()` function
- Authentication uses tokens with expiration dates
- Input data is sanitized to prevent SQL injection
- CORS headers are configured for secure cross-origin requests

## Further Development

- Add password reset functionality
- Implement file upload for images
- Add message sending/receiving for walls
- Create admin functionality for wall management 