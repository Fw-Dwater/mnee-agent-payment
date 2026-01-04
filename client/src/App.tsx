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

  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setSteps([]) 
    setProcessingAction(null)

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: input,
            sessionId: sessionId || undefined 
        })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error("No reader")

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last incomplete chunk in buffer
        buffer = lines.pop() || ""

        for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue
            
            const jsonStr = line.slice(6) // Remove "data: "
            if (jsonStr === '[DONE]') break
            
            try {
                const data = JSON.parse(jsonStr)
                
                if (data.type === 'response') {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
                    // If we get a final response, action is done
                    setProcessingAction(null)
                } 
                else if (data.type === 'step') {
                    setSteps(prev => [...prev, data.step])
                    
                    // Detect active tool calls to show "ing" animation
                    if (data.step.type === 'call') {
                        const toolName = data.step.tool;
                        if (toolName.includes('transfer') || toolName.includes('swap') || toolName.includes('approve')) {
                             setProcessingAction(toolName);
                        } else {
                             setProcessingAction(null); // Simple tools don't need long loading
                        }
                    } else if (data.step.type === 'result' || data.step.type === 'error') {
                        setProcessingAction(null);
                    }
                }
                else if (data.type === 'status') {
                    if (data.status === 'APPROVAL_REQUIRED') {
                        setApprovalRequired(true)
                        setLoading(false) // Stop main loading, wait for user
                        setProcessingAction(null) // Paused
                    }
                    if (data.sessionId) setSessionId(data.sessionId)
                }
                else if (data.type === 'error') {
                     setMessages(prev => [...prev, { role: 'error', content: data.content }])
                     setProcessingAction(null)
                }
            } catch (e) {
                console.error("Error parsing stream line", e)
            }
        }
      }
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'error', content: 'Failed to connect to agent.' }])
      setProcessingAction(null)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approved: boolean) => {
      setApprovalRequired(false)
      setLoading(true) // Resume loading
      setProcessingAction("Processing Approval...") // Manual override for immediate feedback
      
      try {
          const res = await axios.post('http://localhost:3001/api/approve', {
              sessionId,
              action: approved ? 'APPROVED' : 'REJECTED'
          })
          
          // Handle the response similar to chat (it might return final answer or steps)
          // Ideally the backend continues the stream, but for now it returns a JSON.
          // In a full implementation, /api/approve would also return a stream or trigger one.
          // Based on current server_sdk.ts, it returns { response, steps, status }
          
          const { response, steps: newSteps, status } = res.data
          
          if (newSteps) {
              setSteps(newSteps)
          }
          
          if (response) {
              setMessages(prev => [...prev, { role: 'assistant', content: response }])
          }
          
      } catch (e) {
          setMessages(prev => [...prev, { role: 'error', content: 'Error processing approval.' }])
      } finally {
          setLoading(false)
          setProcessingAction(null)
      }
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>Agent Thoughts</h2>
        <div className="steps-container">
          {steps.map((step, idx) => (
            <div key={idx} className={`step-item ${step.type}`}>
              <div className="step-header">
                <span className="step-type">{step.type.toUpperCase()}</span>
                <span className="step-time">{new Date(step.timestamp).toLocaleTimeString()}</span>
              </div>
              
              {step.type === 'thought' && <div className="step-content">{step.content}</div>}
              
              {step.type === 'call' && (
                <div className="step-call">
                  <div className="tool-name">🛠 {step.tool}</div>
                  <pre className="tool-args">{JSON.stringify(step.args, null, 2)}</pre>
                </div>
              )}
              
              {step.type === 'result' && (
                <div className="step-result">
                  <div className="result-label">Output:</div>
                  <pre className="result-content">{step.output}</pre>
                </div>
              )}
            </div>
          ))}
          <div ref={stepsEndRef} />
        </div>
      </div>

      <div className="chat-area">
        <header>
            <h1>MNEE Payment Agent</h1>
            <div className="status-badge">
                {sessionId ? <span className="online">● Online (Session: {sessionId.slice(0,6)}...)</span> : <span className="offline">● Offline</span>}
            </div>
        </header>

        <div className="messages-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="avatar">{msg.role === 'user' ? '👤' : msg.role === 'error' ? '❌' : '🤖'}</div>
              <div className="content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          
          {processingAction && (
              <div className="message assistant processing">
                  <div className="avatar">🤖</div>
                  <div className="content loading-bubble">
                      <div className="spinner"></div>
                      <span>Executing <b>{processingAction}</b> on Blockchain...</span>
                  </div>
              </div>
          )}

          {loading && !processingAction && !approvalRequired && (
            <div className="message assistant">
               <div className="avatar">🤖</div>
               <div className="content typing-indicator">Thinking...</div>
            </div>
          )}

            <div ref={messagesEndRef} />
        </div>

        {approvalRequired && (
            <div className="approval-card-overlay">
                <div className="approval-card">
                    <h3>⚠️ High Value Transaction</h3>
                    <p>The agent wants to execute a transaction that exceeds the auto-approval threshold.</p>
                    <div className="actions">
                        <button className="btn-reject" onClick={() => handleApprove(false)}>Reject</button>
                        <button className="btn-approve" onClick={() => handleApprove(true)}>Approve Transaction</button>
                    </div>
                </div>
            </div>
        )}

        <form className="input-area" onSubmit={handleSubmit}>
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ex: Pay 0.0001 MNEE for weather data..."
            disabled={loading || approvalRequired}
          />
          <button type="submit" disabled={loading || approvalRequired || !input.trim()}>Send</button>
        </form>
      </div>
    </div>
  )
}

export default App
