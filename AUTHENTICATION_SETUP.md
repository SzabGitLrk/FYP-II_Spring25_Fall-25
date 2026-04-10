# MindEase Authentication System Setup Guide

## 🚀 Complete End-to-End Authentication System

This guide will help you set up and test the complete authentication system for MindEase, a mental wellness application.

## 📋 Features Implemented

### Backend (Node.js + Express + MongoDB)
✅ **User Registration** - Name, email, password with validation  
✅ **User Login** - Email + password authentication  
✅ **Password Hashing** - bcrypt with salt rounds  
✅ **JWT Tokens** - Secure authentication tokens  
✅ **Forgot Password** - Email-based password reset  
✅ **Reset Password** - Token-based password reset  
✅ **Authentication Middleware** - JWT protection for routes  
✅ **Email Service** - SMTP integration with Nodemailer  
✅ **Account Security** - Login attempt limiting, account locking  

### Frontend (React + Tailwind CSS)
✅ **Beautiful UI** - MindEase design theme with calming colors  
✅ **Responsive Design** - Mobile and desktop optimized  
✅ **Form Validation** - Real-time validation with error messages  
✅ **Password Requirements** - Visual password strength indicators  
✅ **Smooth Animations** - Framer Motion and CSS transitions  
✅ **Authentication Context** - Global state management  
✅ **Protected Routes** - Automatic redirects based on auth status  

## 🛠️ Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the root directory with the following content:

```env
# Environment Configuration for MindEase

# Application
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/mindease

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-mindease-2024

# Client Configuration
CLIENT_URL=http://localhost:3000

# Email Service (for password reset and welcome emails)
EMAIL_FROM=noreply@mindease.app
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# For development (Ethereal Email - generates test emails)
ETHEREAL_USER=ethereal.user@ethereal.email
ETHEREAL_PASS=ethereal.pass
```

### 2. Database Setup

Make sure MongoDB is running on your system:

```bash
# Start MongoDB (if using local installation)
mongod

# Or if using MongoDB Atlas, update MONGODB_URI in .env
```

### 3. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 4. Create Demo User

```bash
# Create a demo user for testing
npm run create-demo
```

This creates a demo user with:
- **Email:** demo@mindease.com
- **Password:** Demo123!

### 5. Start the Application

```bash
# Start the backend server
npm run dev

# In a new terminal, start the frontend
npm run client
```

## 🧪 Testing the Authentication System

### 1. User Registration
1. Navigate to `http://localhost:3000/register`
2. Fill in the registration form with:
   - First Name: Your first name
   - Last Name: Your last name
   - Email: A valid email address
   - Password: A strong password (8+ chars, uppercase, lowercase, number)
3. Click "Create Account"
4. You should be redirected to the dashboard

### 2. User Login
1. Navigate to `http://localhost:3000/login`
2. Use either:
   - Your registered credentials, OR
   - Demo account: demo@mindease.com / Demo123!
3. Click "Sign In"
4. You should be redirected to the dashboard

### 3. Forgot Password Flow
1. On the login page, click "Forgot your password?"
2. Enter your email address
3. Check your email for the reset link (or check console for Ethereal email preview)
4. Click the reset link
5. Enter a new password
6. You should be redirected to login

### 4. Password Reset
1. Follow the forgot password flow
2. On the reset page, enter a new password
3. Confirm the password
4. Click "Update Password"
5. You should see a success message and be redirected to login

## 🎨 Design Features

### MindEase Theme
- **Colors:** Light blue, mint green, lavender pastels
- **Typography:** Clean, modern fonts (Poppins/Nunito style)
- **Layout:** Rounded card-style containers with shadows
- **Animations:** Smooth transitions and hover effects
- **Icons:** Mental health and wellness themed icons

### UI Components
- **Forms:** Beautiful input fields with icons and validation
- **Buttons:** Gradient buttons with hover animations
- **Cards:** Glass-morphism effect with backdrop blur
- **Responsive:** Mobile-first design with desktop enhancements

## 🔒 Security Features

### Backend Security
- **Password Hashing:** bcrypt with 12 salt rounds
- **JWT Tokens:** Secure authentication with expiration
- **Rate Limiting:** Prevents brute force attacks
- **Input Validation:** Express-validator for all inputs
- **Account Locking:** Temporary lockout after failed attempts
- **CORS Protection:** Configured for secure cross-origin requests

### Frontend Security
- **Token Storage:** Secure localStorage management
- **Route Protection:** Automatic redirects for unauthenticated users
- **Input Sanitization:** Client-side validation and sanitization
- **Error Handling:** Secure error messages without sensitive data

## 📧 Email Configuration

### Development (Ethereal Email)
For development, the system uses Ethereal Email which generates test emails:
- Check the console for email preview URLs
- No actual emails are sent
- Perfect for testing the email flow

### Production Setup
For production, configure real SMTP credentials:
1. Update `EMAIL_USER` and `EMAIL_PASS` in `.env`
2. Use a service like Gmail, SendGrid, or AWS SES
3. Update `EMAIL_FROM` with your domain

## 🚀 API Endpoints

### Authentication Routes
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (protected)
- `POST /api/auth/logout` - Logout user

### Request/Response Examples

#### Registration
```json
POST /api/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "dateOfBirth": "1990-01-01",
  "gender": "male"
}
```

#### Login
```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check the MONGODB_URI in .env

2. **JWT Secret Error**
   - Make sure JWT_SECRET is set in .env
   - Use a strong, unique secret key

3. **Email Not Sending**
   - Check email credentials in .env
   - For development, check console for Ethereal preview URLs

4. **CORS Errors**
   - Ensure CLIENT_URL is set correctly in .env
   - Check that frontend is running on the correct port

### Debug Mode
Set `NODE_ENV=development` in .env to enable:
- Detailed error messages
- Console logging
- Ethereal email previews

## 📱 Mobile Responsiveness

The authentication system is fully responsive:
- **Mobile:** Single column layout with touch-friendly inputs
- **Tablet:** Optimized spacing and sizing
- **Desktop:** Split-screen layout with illustrations

## 🎯 Next Steps

After setting up the authentication system, you can:
1. Add user profile management
2. Implement role-based access control
3. Add social login (Google, Facebook)
4. Set up email verification
5. Add two-factor authentication
6. Implement session management

## 📞 Support

If you encounter any issues:
1. Check the console for error messages
2. Verify all environment variables are set
3. Ensure all dependencies are installed
4. Check MongoDB connection
5. Review the API endpoints and responses

---

**MindEase Authentication System** - Your path to secure mental health applications starts here! 🧠✨
