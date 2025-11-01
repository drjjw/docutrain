# AI Model Comparison Guide

Your chatbot now supports **two powerful AI models**. Here's how to get the best results from each:

## 🤖 Gemini 2.5 Flash (Google)

### Best For:
- ✅ **Structured Information** - Lists, tables, procedures
- ✅ **Factual Queries** - Direct questions about protocols
- ✅ **Fast Responses** - Quick answers to straightforward questions
- ✅ **Detailed Breakdowns** - Step-by-step explanations

### Strengths:
- Very fast response time
- Excellent at organizing information
- Great at finding specific details
- Strong citation accuracy

### Example Questions:
- "What are the objectives for housestaff?"
- "List all the haemodialysis procedures"
- "What are the steps for acute hyperkalemia management?"

---

## 🚀 Grok 4 (xAI)

### Best For:
- ✅ **Complex Reasoning** - Multi-part questions
- ✅ **Contextual Understanding** - Questions requiring interpretation
- ✅ **Comparative Analysis** - "What's the difference between X and Y?"
- ✅ **Explanations** - "Why" and "how" questions

### Strengths:
- Strong analytical capabilities
- Good at synthesizing information
- Excellent at explaining concepts
- Thoughtful responses

### Example Questions:
- "How does the management of acute vs chronic renal failure differ?"
- "Why are these specific protocols recommended?"
- "Compare peritoneal dialysis and haemodialysis approaches"

---

## 🎯 Pro Tips

### When to Switch Models:
1. **Try both** for important questions - compare perspectives
2. **Use Gemini** when you need quick, structured answers
3. **Use Grok** when you need deeper analysis or explanation
4. **Switch if unsatisfied** - different models excel at different things

### Conversation Strategy:
- Start with one model for your initial question
- Switch to the other model to get a different perspective
- Both models have access to the same PDF content
- Conversation history is model-specific (switching clears history)

### Testing Example:

**Question**: "What are the emergency protocols?"

**Gemini Response Style**:
```
Emergency Protocols:
1. Management of acute hyperkalemia
2. Management of acute poisoning
   - Methanol
   - ASA
3. Management of hypertensive emergencies
*(Reference: Performance under Emergency Conditions, Page 6)*
```

**Grok Response Style**:
```
The manual outlines three critical emergency protocols that 
housestaff must be competent in:

Emergency hyperkalemia management is prioritized as it can be 
immediately life-threatening...
[more detailed explanation follows]
```

---

## 🔄 Model Switching

### How to Switch:
1. Click the "🤖 Gemini 2.5" or "🚀 Grok 4" button at the top
2. The active model is highlighted in white
3. Your next message will use the selected model
4. **Note**: Switching clears conversation history (by design)

### API Usage:
```bash
# Use Gemini
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Your question","model":"gemini"}'

# Use Grok
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Your question","model":"grok"}'
```

---

## 📊 Quick Comparison

| Feature | Gemini 2.5 | Grok 4 |
|---------|-----------|--------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡⚡ Fast |
| **Citations** | ⭐⭐⭐ Excellent | ⭐⭐ Good |
| **Reasoning** | ⭐⭐ Good | ⭐⭐⭐ Excellent |
| **Structure** | ⭐⭐⭐ Excellent | ⭐⭐ Good |
| **Explanation** | ⭐⭐ Good | ⭐⭐⭐ Excellent |
| **Lists/Tables** | ⭐⭐⭐ Excellent | ⭐⭐ Good |

---

## 🎓 Learning from Differences

If the models give different responses:
- Both are using the same PDF content
- Different AI architectures interpret text differently
- One may emphasize different aspects of the manual
- Use your judgment to evaluate which is more helpful

---

## 💡 Best Practices

1. **Start Simple** - Try your question with the default model first
2. **Be Specific** - Both models work better with clear, specific questions
3. **Compare Important Queries** - For critical information, check both
4. **Experiment** - Learn which model you prefer for different types of questions
5. **Provide Feedback** - Note which model gave better responses for future reference

---

Enjoy exploring both AI perspectives on your manual! 🚀

