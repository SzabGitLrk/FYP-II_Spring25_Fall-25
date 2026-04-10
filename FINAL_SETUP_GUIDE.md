
# MindEase - Complete Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Git

### 1. Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/mindease

# JWT Secret (generate a strong secret)
JWT_SECRET=your_super_secret_jwt_key_here

# Email Configuration (for password reset)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Client URL
CLIENT_URL=http://localhost:3000

# OpenAI API (for chatbot)
OPENAI_API_KEY=your_openai_api_key
```

### 2. Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 3. Database Setup

Make sure MongoDB is running on your system, then create a demo user:

```bash
npm run create-demo
```

This creates a demo account:
- **Email**: demo@mindease.com
- **Password**: Demo123!

### 4. Running the Application

#### Development Mode (Recommended)

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

#### Production Mode

```bash
# Build frontend
npm run build

# Start production server
npm start
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## 🔧 Features

### ✅ Authentication System
- User registration with validation
- Secure login with JWT tokens
- Password reset via email
- Protected routes
- Demo account for testing

### ✅ Frontend Features
- Responsive design (desktop + mobile)
- Beautiful UI with Tailwind CSS
- Framer Motion animations
- Toast notifications
- Dark/Light theme support

### ✅ Backend Features
- RESTful API
- MongoDB integration
- Email service (Nodemailer)
- Rate limiting
- Security middleware (Helmet, CORS)
- Input validation

### ✅ Pages Available
- **Authentication**: Login, Register, Forgot Password, Reset Password
- **Dashboard**: Main user interface
- **Quizzes**: Mental health assessments
- **Chatbot**: AI-powered mental health support
- **Profile**: User profile management
- **Settings**: Application settings
- **Reports**: Progress tracking
- **Resources**: Mental health resources

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Quizzes
- `GET /api/quizzes` - Get all quizzes
- `GET /api/quizzes/:id` - Get specific quiz
- `POST /api/quizzes/:id/submit` - Submit quiz answers

### Chatbot
- `POST /api/chatbot/message` - Send message to AI chatbot

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard analytics

## 🎨 Design System

### Colors
- **Primary**: Blue gradients (calm, professional)
- **Secondary**: Purple/Indigo gradients
- **Accent**: Emerald/Teal for success states
- **Background**: Light gradients with pastel tones

### Typography
- **Font**: Poppins/Nunito (Google Fonts)
- **Sizes**: Responsive typography scale

### Components
- Glass-morphism effects
- Rounded corners (12px-24px)
- Subtle shadows and gradients
- Smooth animations with Framer Motion

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- CORS protection
- Helmet security headers
- Input validation and sanitization
- Secure password reset tokens (15-minute expiry)

## 📱 Responsive Design

### Desktop (lg: 1024px+)
- Two-column layout with illustration
- Elaborate animations and effects
- Full feature set

### Mobile (< 1024px)
- Single-column layout
- Simplified design
- Touch-optimized interface

## 🚀 Deployment

### Heroku Deployment
1. Create Heroku app
2. Set environment variables in Heroku dashboard
3. Connect GitHub repository
4. Deploy

### Vercel/Netlify (Frontend)
1. Build the frontend: `npm run build`
2. Deploy the `client/build` folder

### MongoDB Atlas (Database)
1. Create MongoDB Atlas cluster
2. Update `MONGODB_URI` in environment variables
3. Whitelist your IP addresses

## 🐛 Troubleshooting

### Common Issues

1. **Port 5000 already in use**
   ```bash
   # Kill process using port 5000
   npx kill-port 5000
   ```

2. **MongoDB connection error**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file

3. **Email not working**
   - Use App Password for Gmail
   - Check EMAIL_USER and EMAIL_PASS

4. **Frontend not connecting to backend**
   - Verify proxy setting in client/package.json
   - Check CORS configuration

### Demo Account
- **Email**: demo@mindease.com
- **Password**: Demo123!

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the console logs
3. Verify environment variables
4. Ensure all dependencies are installed

## 🎯 Next Steps

1. Customize the branding and colors
2. Add more quiz content
3. Integrate with real email service
4. Add more AI chatbot features
5. Implement user analytics
6. Add social features

---

**MindEase** - Your path to clarity starts here. 🌟
