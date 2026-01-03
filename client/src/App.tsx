import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './App.css'

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface Step {
  type: 'thought' | 'call' | 'result';
  content?: string;
  tool?: string;
  args?: any;
  output?: string;
  timestamp: number;
}

function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '👋 Hi! I am your MNEE Payment Agent. I can check balances, approve transactions, pay for services, and track your history on Sepolia. Try "Check my history"!' }
  ])
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [sessionId, setSessionId] = useState<string>("")
  const [approvalRequired, setApprovalRequired] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const stepsEndRef = useRef<HTMLDivElement>(null)

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('mnee_session_id')
    if (savedSessionId) {
        setSessionId(savedSessionId)
        fetchHistory(savedSessionId)
    }
  }, [])

  // Save session to localStorage when it changes
  useEffect(() => {
    if (sessionId) {
        localStorage.setItem('mnee_session_id', sessionId)
    }
  }, [sessionId])

  const fetchHistory = async (sid: string) => {
      try {
          setLoading(true)
          const res = await axios.get(`http://localhost:3001/api/history/${sid}`)
          const { messages: historyMsgs, steps: historySteps } = res.data
          
          if (historyMsgs && historyMsgs.length > 0) {
              // Merge with default greeting if needed, or just replace
              // Keeping the default greeting at the top is nice
              setMessages([
                  { role: 'assistant', content: '👋 Hi! I am your MNEE Payment Agent. I can check balances, approve transactions, pay for services, and track your history on Sepolia. Try "Check my history"!' },
                  ...historyMsgs
              ])
          }
          if (historySteps) {
              setSteps(historySteps)
          }
      } catch (e) {
          console.error("Failed to load history", e)
      } finally {
          setLoading(false)
      }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  
  const scrollToStepsBottom = () => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, approvalRequired])

  useEffect(() => {
    scrollToStepsBottom()
  }, [steps])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    // Don't clear steps immediately, maybe append or clear based on user pref. 
    // For now, let's clear to show fresh trace for new request
    setSteps([]) 

    try {
      const response = await axios.post('http://localhost:3001/api/chat', {
        message: userMsg.content,
        sessionId: sessionId || undefined
      })

      const { response: finalResponse, status, sessionId: sid, steps: newSteps } = response.data
      if (sid) setSessionId(sid)
      if (newSteps) setSteps(newSteps)

      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: finalResponse }
      ])

      if (status === "APPROVAL_REQUIRED") {
        setApprovalRequired(true)
      }

    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'error', content: '❌ Connection failed. Ensure the backend server is running.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (action: 'APPROVED' | 'REJECTED') => {
    setLoading(true)
    setApprovalRequired(false)
    
    // Add a UI message to show what user clicked
    setMessages(prev => [...prev, { role: 'user', content: `[${action}]` }])

    try {
        const response = await axios.post('http://localhost:3001/api/approve', {
            sessionId,
            action
        });
        const { response: finalResponse, steps: newSteps } = response.data;
        if (newSteps) setSteps(prev => [...prev, ...newSteps]);
        
        setMessages(prev => [...prev, { role: 'assistant', content: finalResponse }]);
    } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { role: 'error', content: '❌ Approval request failed.' }]);
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar / Logs Panel */}
      <aside className="logs-panel">
        <div className="panel-header">
          <h3>⛓️ Agent Logic Chain</h3>
          <span className={`status-badge ${loading ? 'running' : 'idle'}`}>
            {loading ? 'Running' : 'Idle'}
          </span>
        </div>
        <div className="steps-container">
            {steps.length === 0 ? (
                <div className="empty-state">
                  <p>Waiting for instructions...</p>
                  {sessionId && <p className="session-id">Session: {sessionId.slice(0, 8)}...</p>}
                </div>
            ) : (
                steps.map((step, idx) => (
                    <div key={idx} className={`step-item ${step.type || 'unknown'}`}>
                        <div className="step-header">
                            <span className="step-type">{step.type ? step.type.toUpperCase() : 'UNKNOWN'}</span>
                            <span className="step-time">{step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : ''}</span>
                        </div>
                        <div className="step-content">
                            {step.type === 'thought' && <p>{step.content}</p>}
                            {step.type === 'call' && (
                                <div className="tool-call">
                                    <strong>🛠️ {step.tool}</strong>
                                    <pre>{JSON.stringify(step.args, null, 2)}</pre>
                                </div>
                            )}
                            {step.type === 'result' && (
                                <div className="tool-result">
                                    <pre>{step.output}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
            <div ref={stepsEndRef} />
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-interface">
        <header className="chat-header">
          <h1>MNEE Agent Payment SDK</h1>
          <p>Powered by LangGraph & DeepSeek</p>
        </header>

        <div className="messages-area">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-bubble ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'assistant' ? '🤖' : msg.role === 'user' ? '👤' : '⚠️'}
              </div>
              <div className="message-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-bubble assistant">
               <div className="message-avatar">🤖</div>
               <div className="typing-indicator">
                 <span></span><span></span><span></span>
               </div>
            </div>
          )}
          
          {/* Approval UI */}
          {approvalRequired && !loading && (
            <div className="approval-container fade-in">
                <div className="approval-card">
                    <h4>⚠️ High Value Transaction</h4>
                    <p>The agent wants to execute a transaction above the safety threshold.</p>
                    <div className="approval-actions">
                        <button className="btn-approve" onClick={() => handleApproval('APPROVED')}>
                            ✅ Approve
                        </button>
                        <button className="btn-reject" onClick={() => handleApproval('REJECTED')}>
                            ❌ Reject
                        </button>
                    </div>
                </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="input-area" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={approvalRequired ? "Please approve or reject above..." : "Ask me to pay someone..."}
            disabled={loading || approvalRequired}
          />
          <button type="submit" disabled={loading || !input.trim() || approvalRequired}>
            Send
          </button>
        </form>
      </main>
    </div>
  )
}

export default App
