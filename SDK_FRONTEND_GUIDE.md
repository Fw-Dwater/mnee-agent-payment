# Frontend Integration Guide for MNEE SDK

This guide demonstrates how to integrate the MNEE SDK into your React application using the provided backend API.

## API Endpoints

Your backend (using `server_sdk.ts`) exposes two main endpoints:

1.  `POST /api/chat`: Send a message to the agent.
2.  `POST /api/approve`: Approve or reject a pending transaction.

## React Component Example

Here is a complete, reusable React component that handles the chat interface and the approval flow.

```jsx
import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3001/api';

export default function AgentChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId] = useState(uuidv4());
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/chat`, {
        message: input,
        sessionId: sessionId
      });

      if (res.data.status === 'APPROVAL_REQUIRED') {
        setApprovalRequest({
          sessionId: res.data.sessionId,
          message: res.data.response
        });
        setMessages(prev => [...prev, { role: 'agent', content: res.data.response, isWarning: true }]);
      } else {
        setMessages(prev => [...prev, { role: 'agent', content: res.data.response }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'error', content: "Error communicating with agent." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (action) => {
    // action: "APPROVED" | "REJECTED"
    setLoading(true);
    setApprovalRequest(null); // Clear modal/prompt

    try {
      const res = await axios.post(`${API_URL}/approve`, {
        sessionId: sessionId,
        action: action
      });

      setMessages(prev => [...prev, { role: 'agent', content: res.data.response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'error', content: "Error submitting approval." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role} ${msg.isWarning ? 'warning' : ''}`}>
            <strong>{msg.role === 'user' ? 'You' : 'Agent'}:</strong> {msg.content}
          </div>
        ))}
        {loading && <div className="loading">Agent is thinking...</div>}
      </div>

      {approvalRequest && (
        <div className="approval-modal">
          <h3>Transaction Approval Required</h3>
          <p>{approvalRequest.message}</p>
          <button onClick={() => handleApproval("APPROVED")} className="btn-approve">Approve</button>
          <button onClick={() => handleApproval("REJECTED")} className="btn-reject">Reject</button>
        </div>
      )}

      <div className="input-area">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Ask me to transfer MNEE..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={!!approvalRequest} // Disable input while waiting for approval
        />
        <button onClick={sendMessage} disabled={loading || !!approvalRequest}>Send</button>
      </div>
    </div>
  );
}
```

## Styles (CSS)

Add these basic styles to visualize the approval state:

```css
.warning {
  background-color: #fff3cd;
  border-left: 4px solid #ffc107;
  padding: 10px;
}

.approval-modal {
  background: white;
  border: 2px solid #dc3545;
  padding: 20px;
  margin: 10px 0;
  border-radius: 8px;
  text-align: center;
}

.btn-approve {
  background: #28a745;
  color: white;
  margin: 0 10px;
}

.btn-reject {
  background: #dc3545;
  color: white;
  margin: 0 10px;
}
```
