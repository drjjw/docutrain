# SMH Housestaff Manual Chatbot

A Node.js chatbot with **dual AI model support** that answers questions based exclusively on the SMH Housestaff Manual PDF.

## Features

- 🤖 **Dual AI Models** - Switch between Gemini 2.5 Flash & Grok 4
- 📄 **PDF Context** - Loads entire PDF into context
- 🔒 **Constrained Responses** - Only answers from manual content
- 💬 **Chat Interface** - Clean, modern web UI with model selector
- 📝 **Conversation History** - Maintains chat context
- ⚡ **Real-time Switching** - Toggle between models on the fly

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configuration

Create a `.env` file in the root directory with your API keys:
```
GEMINI_API_KEY=your_gemini_api_key_here
XAI_API_KEY=your_xai_api_key_here
PORT=3000
```

Get your API keys from:
- **Gemini**: [Google AI Studio](https://makersuite.google.com/)
- **Grok/xAI**: [xAI Console](https://console.x.ai/)

### 3. Run the Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

### 4. Open the Chatbot

Navigate to: **http://localhost:3000**

## How It Works

1. **PDF Loading**: On startup, the server extracts all text from `SMH Housestaff Manual.pdf`
2. **Context Injection**: The entire PDF content is included in the system prompt
3. **Model Selection**: Choose between Gemini 2.5 or Grok 4 via toggle buttons
4. **Query Processing**: User questions are sent to the selected AI with the PDF context
5. **Constrained Responses**: Both models are instructed to only use information from the manual

## Available Models

### 🤖 Gemini 2.5 Flash
- Google's latest model (2025)
- Fast and efficient
- Excellent at document analysis
- Great for structured information

### 🚀 Grok 4 (grok-4-fast-non-reasoning)
- xAI's powerful model
- Strong reasoning capabilities
- Different perspective on the same content
- Good for complex queries

**Pro Tip**: Try asking the same question to both models to compare their responses!

## Project Structure

```
.
├── server.js                      # Express server & Gemini integration
├── public/
│   └── index.html                 # Chat interface
├── SMH Housestaff Manual.pdf      # Source document
├── package.json                   # Dependencies
├── .env                          # API keys (not committed)
└── README.md                      # This file
```

## API Endpoints

### POST /api/chat
Send a chat message and get a response.

**Request:**
```json
{
  "message": "What are the resident responsibilities?",
  "history": []
}
```

**Response:**
```json
{
  "response": "Based on the manual...",
  "metadata": {
    "pdfPages": 50,
    "pdfTitle": "SMH Housestaff Manual"
  }
}
```

### GET /api/health
Check server and PDF loading status.

## Technologies

- **Node.js** - Runtime
- **Express** - Web framework
- **@google/generative-ai** - Gemini API client
- **openai** - OpenAI-compatible client for Grok
- **pdf-parse** - PDF text extraction
- **marked.js** - Markdown rendering
- **dotenv** - Environment variables

## Notes

- The PDF is loaded into memory on startup
- Conversation history is maintained per session
- The AI is constrained to only use manual content
- If information isn't in the manual, the bot will say so

## Troubleshooting

**PDF not loading?**
- Ensure `SMH Housestaff Manual.pdf` is in the project root
- Check file permissions

**API errors?**
- Verify your Gemini API key in `.env`
- Check your API quota at [Google AI Studio](https://makersuite.google.com/)

**Server won't start?**
- Ensure port 3000 is available
- Run `npm install` to install dependencies

