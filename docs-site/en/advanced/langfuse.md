---
title: Langfuse Tracing
---

# Langfuse Tracing

Langfuse helps you understand how the AI processes your requests. It provides detailed traces of every conversation, including thinking processes, tool calls, and response times.

## What is Langfuse?

Langfuse is an observability tool that tracks:
- What you asked and what the AI responded
- How long each step took
- How many tokens were processed
- Which tools the AI used

## Viewing Traces

### Step 1: Get Your Dashboard URL

Ask your administrator for your Langfuse dashboard URL.

### Step 2: Open the Dashboard

1. Open the URL in your web browser
2. Log in with your credentials (if required)

### Step 3: Browse Conversations

1. Click on **Traces** in the sidebar
2. Select a conversation to view details
3. Expand each step to see the full data

## Understanding Trace Data

| Field | Description |
|-------|-------------|
| **Input** | The message you sent to the AI |
| **Output** | The AI's response |
| **Latency** | How long the step took (in milliseconds) |
| **Tokens** | Number of tokens processed (affects cost) |
| **Tool Calls** | External tools or services used |

## Tips

- Use traces to understand why the AI gave a certain response
- Share trace links with support for faster troubleshooting
- Check latency to identify slow operations
- Monitor token usage to optimize costs

## Related

- [Chat Interface](/en/core/agent-chat)
