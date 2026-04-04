# MindEase AI Chatbot Setup Guide

## Overview

The MindEase AI Chatbot has been enhanced with ChatGPT-like responses specifically focused on mental health topics. The chatbot uses OpenAI's GPT-3.5-turbo model to provide empathetic, supportive, and evidence-based responses while maintaining strict focus on mental health and emotional well-being.

## Features

### 🤖 ChatGPT-Like AI Responses
- Advanced AI responses powered by OpenAI GPT-3.5-turbo
- Conversational and empathetic tone similar to ChatGPT
- Context-aware responses with conversation memory
- Evidence-based mental health guidance

### 🧠 Mental Health Focus
- **Strict Content Filtering**: Only responds to mental health topics
- **Topic Redirection**: Gently redirects non-mental health questions
- **Crisis Detection**: Automatically detects and responds to crisis situations
- **Professional Boundaries**: Never provides medical diagnoses or replaces therapy

### 🛡️ Safety Features
- Crisis keyword detection and immediate resource provision
- Content validation to ensure appropriate responses
- Fallback responses when AI service is unavailable
- Privacy-focused conversation storage

## Setup Instructions

### 1. Environment Configuration

Add your OpenAI API key to your `.env` file:

```bash
# OpenAI Integration (Required for enhanced chatbot)
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Install Dependencies

The required dependencies are already included in `package.json`:

```bash
npm install
```

### 3. Test the Chatbot

Run the test script to validate the chatbot functionality:

```bash
npm run test-chatbot
```

### 4. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### POST /api/chatbot/message
Send a message to the AI chatbot.

**Request Body:**
```json
{
  "message": "I'm feeling stressed about work",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "response": "I understand that stress can be overwhelming...",
  "messageId": "chat-message-id"
}
```

### GET /api/chatbot/history
Get chat history for a user.

**Query Parameters:**
- `sessionId` (optional): Specific session ID
- `limit` (optional): Number of messages to return (default: 50)

### POST /api/chatbot/feedback
Submit feedback for a chat message.

**Request Body:**
```json
{
  "messageId": "chat-message-id",
  "helpful": true,
  "rating": 5,
  "comment": "Very helpful response"
}
```

## Mental Health Topics Covered

The chatbot is designed to respond to:

- **Stress Management**: Work stress, life pressure, overwhelm
- **Anxiety Support**: Panic attacks, worry, nervousness
- **Depression Help**: Low mood, hopelessness, sadness
- **Coping Strategies**: Mindfulness, relaxation, self-care
- **Sleep Issues**: Insomnia, sleep hygiene, rest problems
- **Relationships**: Social anxiety, loneliness, communication
- **Trauma Support**: PTSD, grief, loss, recovery
- **Crisis Intervention**: Suicidal thoughts, self-harm, emergency resources

## Content Filtering

### Mental Health Topics (Allowed)
- Stress, anxiety, depression, mood, emotions
- Therapy, counseling, mental health, wellbeing
- Coping strategies, mindfulness, meditation
- Sleep, relationships, trauma, self-care
- Crisis support, suicide prevention

### Non-Mental Health Topics (Redirected)
- Technology, programming, coding
- Cooking, recipes, food
- Travel, vacation, tourism
- Sports, games, entertainment
- Politics, business, finance
- General news, current events

## Crisis Detection

The chatbot automatically detects crisis indicators and provides immediate resources:

### Crisis Keywords
- Suicide, self-harm, wanting to die
- Hopeless, worthless, burden
- Self-destructive behaviors

### Crisis Response
- Immediate crisis helpline numbers
- Emergency service contacts
- Professional resource recommendations
- Supportive, non-judgmental language

## Conversation Memory

The chatbot maintains context through:

- **Session-based Memory**: Remembers conversation within a session
- **Context Awareness**: Uses previous messages for better responses
- **User History**: Tracks conversation patterns and preferences
- **Sentiment Analysis**: Monitors emotional state over time

## Error Handling

### Fallback Responses
When the OpenAI API is unavailable, the chatbot provides:
- Pre-written responses for common mental health topics
- Crisis detection and resource provision
- Supportive fallback messages

### Error Scenarios
- API rate limits
- Network connectivity issues
- Invalid API responses
- Service downtime

## Security & Privacy

### Data Protection
- Conversations are encrypted and stored securely
- User data is anonymized for analytics
- No personal information is shared with third parties
- GDPR-compliant data handling

### Content Moderation
- Automatic content filtering
- Inappropriate content detection
- Crisis situation monitoring
- Professional boundary enforcement

## Monitoring & Analytics

### Conversation Analytics
- Message volume and frequency
- Topic distribution and trends
- User engagement metrics
- Crisis intervention tracking

### Performance Metrics
- Response time and accuracy
- User satisfaction ratings
- Error rates and fallback usage
- API usage and costs

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**
   - Check API key configuration
   - Verify API quota and billing
   - Monitor rate limits

2. **No Response from Chatbot**
   - Check server logs for errors
   - Verify database connectivity
   - Test fallback responses

3. **Inappropriate Responses**
   - Review content filtering rules
   - Check system prompt configuration
   - Validate response processing

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=chatbot:*
```

## Best Practices

### For Users
- Be specific about your mental health concerns
- Use the chatbot as a supplement to professional care
- Seek immediate help for crisis situations
- Provide feedback to improve responses

### For Developers
- Monitor API usage and costs
- Regularly update crisis detection keywords
- Review and improve content filtering
- Maintain conversation data privacy

## Support

For technical support or questions about the chatbot:

1. Check the test script: `npm run test-chatbot`
2. Review server logs for errors
3. Verify environment configuration
4. Test with different message types

## Future Enhancements

Planned improvements include:

- Multi-language support
- Voice message integration
- Advanced sentiment analysis
- Integration with therapy scheduling
- Mobile app optimization
- Enhanced crisis intervention protocols

---

**Important**: This chatbot is designed to supplement, not replace, professional mental health care. Always encourage users to seek professional help when needed.

