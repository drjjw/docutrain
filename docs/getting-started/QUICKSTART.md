# 🚀 Quick Start Guide

## Your Chatbot is Running!

Your PDF-based chatbot is now **live and running** at:

### 👉 **http://localhost:3000**

---

## ✅ What's Working

- ✓ Server is running on port 3000
- ✓ PDF loaded: **91 pages, 112,252 characters**
- ✓ **Dual AI Models**: Gemini 2.5 Flash & Grok 4
- ✓ Model selector toggle in the UI
- ✓ Chatbot responds only to content from the manual
- ✓ Beautiful web interface with markdown formatting

---

## 🎯 How to Use

### Option 1: Web Interface (Recommended)
1. Open your browser
2. Go to: **http://localhost:3000**
3. **Choose your AI model**: Click either "🤖 Gemini 2.5" or "🚀 Grok 4"
4. Start chatting!
5. Switch models anytime to compare responses

### Option 2: API (For developers)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What are the objectives for housestaff?"}'
```

---

## 📝 Example Questions You Can Ask

- "What are the main topics covered in this manual?"
- "What are the objectives for housestaff?"
- "Tell me about haemodialysis procedures"
- "What are the emergency management protocols?"
- "What is the approach to acute renal failure?"

---

## 🛠 Server Management

### Check if server is running:
```bash
curl http://localhost:3000/api/health
```

### Stop the server:
```bash
pkill -f "node server.js"
```

### Restart the server:
```bash
cd /Users/jordanweinstein/Downloads/chat
npm start
```

### View server logs (if running in foreground):
```bash
cd /Users/jordanweinstein/Downloads/chat
npm start
```

---

## 🔧 Configuration

All settings are in `.env`:
- `GEMINI_API_KEY`: Your Gemini API key (already configured)
- `PORT`: Server port (default: 3000)

---

## 📦 Project Files

```
/Users/jordanweinstein/Downloads/chat/
├── server.js                      # Backend server
├── public/index.html              # Chat interface
├── SMH Housestaff Manual.pdf      # Your PDF document
├── package.json                   # Dependencies
├── .env                          # Configuration
└── README.md                      # Full documentation
```

---

## 🎨 Features

### Dual AI Models
Choose between two powerful AI models:

**🤖 Gemini 2.5 Flash**
- Google's latest model (2025)
- Fast and efficient responses
- Excellent at structured information
- Great for factual queries

**🚀 Grok 4 (grok-4-fast-non-reasoning)**
- xAI's powerful model
- Strong reasoning capabilities
- Different analytical approach
- Great for complex queries

### Smart Responses
Both models:
- Only answer from the manual content
- Cite page numbers and sections
- Admit when they don't know
- Maintain conversation context
- Provide detailed, accurate information with markdown formatting

### Limitations
The chatbot will say "I don't have that information in the SMH Housestaff Manual" if:
- The question is about topics not in the manual
- You ask about current events or general knowledge
- The information requested isn't in the PDF

---

## 🆘 Troubleshooting

**Can't access http://localhost:3000?**
- Make sure the server is running: `curl http://localhost:3000/api/health`
- Check if port 3000 is in use: `lsof -i :3000`

**Chatbot not responding?**
- Check your internet connection (needs to call Gemini API)
- Verify API key in `.env` file
- Check server logs for errors

**Want to change the PDF?**
- Replace `SMH Housestaff Manual.pdf` with your new PDF
- Keep the same filename, or update the path in `server.js` (line 31)
- Restart the server

---

## 💡 Tips

1. **Ask specific questions** for better answers
2. **Include context** in your questions when needed
3. **Reference sections** mentioned in previous responses
4. **Start a new session** if you want to clear conversation history (refresh the page)

---

## 🚀 Next Steps

Want to enhance your chatbot? You can:
- Add authentication
- Implement RAG for larger documents
- Add voice input/output
- Deploy to a cloud server
- Support multiple PDFs
- Add citation links

Enjoy your chatbot! 🎉

