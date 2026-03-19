---
title: Troubleshooting
---

# Troubleshooting

This guide helps you solve common problems with Agent Builder.

## Agent Issues

### Agent not responding

**Symptoms:** Agent doesn't reply or seems stuck.

**Solutions:**
1. **Check your internet connection** - Agent Builder requires a stable connection
2. **Refresh the page** - Sometimes the connection drops and needs to be re-established
3. **Check the agent status** - Look for a green indicator in the sidebar
4. **Try a different agent** - If other agents work, the issue may be specific to one agent

### Agent gives wrong answers

**Symptoms:** Agent provides incorrect or irrelevant information.

**Solutions:**
1. **Refine the persona** - Make the agent's instructions more specific
2. **Check knowledge base** - Ensure the right documents are uploaded
3. **Be more specific** - Provide clearer context in your questions
4. **Check enabled tools** - Make sure relevant tools are enabled

### Agent keeps using wrong tools

**Symptoms:** Agent calls unnecessary tools or ignores relevant ones.

**Solutions:**
1. **Review persona** - Add explicit instructions about when to use which tools
2. **Disable unused tools** - Remove tools the agent shouldn't use
3. **Check tool descriptions** - Tools with unclear descriptions may confuse the agent

## Knowledge Base Issues

### Documents not being found

**Symptoms:** Agent says "I don't have information about that" even when documents exist.

**Solutions:**
1. **Check document upload** - Verify files uploaded successfully (no error messages)
2. **Wait for processing** - Large documents may take a few minutes to index
3. **Try different phrasing** - The AI uses semantic search, so try synonyms
4. **Check file format** - Some PDFs are image-based and can't be read (try DOCX instead)

### Upload fails

**Symptoms:** Error message when uploading documents.

**Solutions:**
1. **Check file size** - Maximum is 100MB per file
2. **Check file format** - Supported: PDF, DOCX, TXT, MD
3. **Try smaller batches** - Upload fewer files at once
4. **Check network** - Unstable connections can cause upload failures

### Search results are irrelevant

**Symptoms:** Agent retrieves wrong information from knowledge base.

**Solutions:**
1. **Use more specific queries** - Add context to help the AI understand
2. **Check document content** - Ensure the information actually exists in your documents
3. **Clean up documents** - Remove outdated or conflicting information

## MCP Service Issues

### Service shows as "Disconnected"

**Symptoms:** MCP service status shows red or "Disconnected".

**Solutions:**
1. **Toggle the service off and on** - Sometimes reconnects automatically
2. **Check server status** - Contact your administrator to verify the service is running
3. **Check service configuration** - Ensure the service URL is correct

### Tool calls fail

**Symptoms:** Agent tries to use a tool but gets an error.

**Solutions:**
1. **Check service logs** - Contact your administrator for detailed error logs
2. **Verify tool parameters** - Some tools require specific input formats
3. **Try a simpler query** - Complex requests may timeout

## Performance Issues

### Slow responses

**Symptoms:** Agent takes a long time to respond.

**Solutions:**
1. **Reduce knowledge base size** - Too many documents can slow searches
2. **Disable unused tools** - Each tool adds processing overhead
3. **Simplify queries** - Break complex questions into smaller parts
4. **Check server load** - Peak hours may have slower response times

### Streaming stops mid-response

**Symptoms:** Response cuts off before completion.

**Solutions:**
1. **Refresh the page** - Connection may have dropped
2. **Check network stability** - Unstable connections interrupt streaming
3. **Try again** - Temporary server issues may resolve themselves

## UI Issues

### Sidebar not loading

**Symptoms:** Agent list or conversation history doesn't appear.

**Solutions:**
1. **Hard refresh** - Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. **Clear browser cache** - Old cached data may cause issues
3. **Try a different browser** - Chrome or Firefox recommended

### Chat input not working

**Symptoms:** Can't type or send messages.

**Solutions:**
1. **Click the input field** - It may not be focused
2. **Check for error messages** - Look for red banners or notifications
3. **Refresh the page** - UI state may be corrupted

## Error Messages

### "Environment initialization failed"

This means the agent's execution environment couldn't start.

**Solutions:**
1. Wait a few minutes and try again
2. Contact your administrator - this is a server-side issue

### "Rate limit exceeded"

Too many requests have been made.

**Solutions:**
1. Wait a few minutes before continuing
2. Reduce the frequency of messages
3. Contact your administrator to increase limits

### "Token limit exceeded"

Your message or the response is too long.

**Solutions:**
1. Shorten your message
2. Break your request into multiple messages
3. Ask the agent to be more concise

## Still Having Issues?

1. **Check the [FAQ](./faq)** - Your question may already be answered
2. **Contact your administrator** - They can check server logs and configurations
3. **Report the bug** - If you believe this is a software bug, report it with:
   - What you were trying to do
   - What happened instead
   - Any error messages you saw
   - Screenshots if possible
