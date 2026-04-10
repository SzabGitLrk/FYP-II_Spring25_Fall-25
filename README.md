# MindEase - Mental Health Platform

A comprehensive mental health platform with AI-powered chatbot, interactive assessments, and wellness tracking tools.

## 🚀 Features

### ✅ **Fixed & Working**
- **Authentication System**: Complete login/register with JWT tokens
- **Dashboard**: Modern UI with quick actions and progress tracking
- **Theme Toggle**: Dark/light mode switching functionality
- **Assessments**: Comprehensive mental health questionnaires
  - Stress Assessment (12 questions)
  - Anxiety Screening (15 questions) 
  - Depression Check (9 questions)
  - General Wellbeing (15 questions)
- **Reports & Analytics**: Interactive charts with Chart.js
  - Progress tracking over time
  - Wellbeing breakdown charts
  - Activity monitoring
- **Resources**: Working links to mental health content
  - Educational articles and videos
  - Support group directories
  - Crisis helpline information
- **Responsive Design**: Mobile-friendly interface

### 🔧 **Technical Improvements**
- Database integration with MongoDB
- Proper API endpoints for authentication
- Chart.js integration for analytics
- Comprehensive CSS styling with Tailwind
- Proper routing and navigation

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

### 1. Clone and Install Dependencies
   ```bash
   git clone <repository-url>
   cd mindease
   npm install
   cd client
   npm install
   cd ..
   ```

### 2. Environment Configuration
Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/mindease
JWT_SECRET=your-super-secret-jwt-key-change-in-production
   CLIENT_URL=http://localhost:3000
   ```

### 3. Database Setup
Ensure MongoDB is running:
```bash
# Start MongoDB (if local)
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env
```

### 4. Start the Application
   ```bash
# Terminal 1 - Start backend server
   npm run dev

# Terminal 2 - Start frontend
   npm run client
   ```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Demo Account**: demo@mindease.com / Demo123!

## 📱 Key Pages & Features

### **Dashboard**
- Quick action buttons with proper icons
- Progress tracking and statistics
- Recent activity feed
- Theme toggle functionality

### **Assessments**
- **Stress Assessment**: 12 comprehensive questions
- **Anxiety Screening**: 15 detailed questions
- **Depression Check**: 9 clinical questions
- **General Wellbeing**: 15 holistic questions

### **Reports & Analytics**
- Interactive line charts for progress tracking
- Doughnut charts for wellbeing breakdown
- Bar charts for weekly activity
- Time range selectors (week/month/quarter)
- Metric filtering options

### **Resources & Support**
- **Educational Content**: Articles, videos, audio guides
- **Support & Community**: Support groups, forums, workshops
- **Crisis Resources**: Emergency helplines and contacts
- Search and filter functionality

## 🎨 UI/UX Improvements

### **Visual Enhancements**
- Modern gradient backgrounds
- Smooth animations and transitions
- Responsive card layouts
- Consistent color scheme
- Professional typography

### **User Experience**
- Intuitive navigation
- Clear call-to-action buttons
- Progress indicators
- Hover effects and feedback
- Mobile-responsive design

## 🔐 Authentication & Security

### **Features**
- JWT token-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- Secure session management

### **API Endpoints**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get user profile
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset
- `POST /api/auth/change-password` - Change password

## 📊 Data Models

### **User Model**
- Personal information (name, email, DOB)
- Mental health profile
- Preferences and settings
- Assessment history

### **Quiz Model**
- Question structure and options
- Scoring algorithms
- Result interpretation
- Recommendations

### **Assessment Results**
- Score tracking
- Progress monitoring
- Trend analysis
- Personalized insights

## 🚀 Deployment

### **Production Build**
```bash
# Build frontend
npm run build

# Start production server
npm start
```

### **Environment Variables**
- Set `NODE_ENV=production`
- Use strong JWT secret
- Configure MongoDB Atlas
- Set up proper CORS origins

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support or questions:
- Create an issue in the repository
- Check the documentation
- Review the code comments

## 🔮 Future Enhancements

- AI-powered chatbot integration
- Mobile app development
- Advanced analytics dashboard
- Community features
- Professional therapist matching
- Integration with health devices

---

**MindEase** - Your journey to better mental health starts here. 🌟
