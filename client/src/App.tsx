import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import './App.css'

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface Step {
  type: 'thought' | 'call' | 'result' | 'error';
  content?: string;
  tool?: string;
  args?: any;
  output?: string;
  timestamp: number;
}

function App() {
  const { address, isConnected } = useAccount();
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '👋 Hi! I am your MNEE Payment Agent. I can check balances, approve transactions, pay for services, and track your history on Sepolia. Try "Check my history"!' }
  ])
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [sessionId, setSessionId] = useState<string>("")
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [pendingTool, setPendingTool] = useState<any>(null)
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [showThoughts] = useState(true); // Toggle for thoughts sidebar
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const stepsEndRef = useRef<HTMLDivElement>(null)

  // Batch Form State
  const [batchFormRows, setBatchFormRows] = useState<{to: string, amount: string}[]>([{ to: '', amount: '' }]);

  useEffect(() => {
    if (approvalRequired && pendingTool && pendingTool.name === 'request_batch_transfer_input') {
        const count = pendingTool.args.count || 3;
        const defaultAmount = pendingTool.args.defaultAmount || '';
        const rows = Array(count).fill(0).map(() => ({ to: '', amount: defaultAmount }));
        setBatchFormRows(rows);
    }
  }, [approvalRequired, pendingTool]);

  const handleBatchFormChange = (index: number, field: 'to' | 'amount', value: string) => {
      const newRows = [...batchFormRows];
      newRows[index][field] = value;
      setBatchFormRows(newRows);
  };

  const handleAddRow = () => {
      setBatchFormRows([...batchFormRows, { to: '', amount: pendingTool?.args?.defaultAmount || '' }]);
  };

  const handleRemoveRow = (index: number) => {
      setBatchFormRows(batchFormRows.filter((_, i) => i !== index));
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setApprovalRequired(false);
      setPendingTool(null);
      setLoading(true);
      setProcessingAction("Processing Batch Input...");

      try {
          const validRows = batchFormRows.filter(r => r.to.trim() !== '' && r.amount.trim() !== '');
          const inputData = { payments: validRows };
          
          const res = await axios.post('/api/submit-input', {
              sessionId,
              toolCallId: pendingTool?.id,
              inputData
          });
          
          const { response, steps: newSteps } = res.data;
          if (newSteps) setSteps(newSteps);
          if (response) setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      } catch (e) {
          setMessages(prev => [...prev, { role: 'error', content: 'Error submitting batch input.' }]);
      } finally {
          setLoading(false);
          setProcessingAction(null);
      }
  };

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

  // Poll for jobs
  useEffect(() => {
    const fetchJobs = async () => {
        try {
            const res = await axios.get('/api/jobs');
            setActiveJobs(res.data.jobs || []);
        } catch (e) {
            console.error("Failed to fetch jobs");
        }
    };
    
    fetchJobs(); // Initial fetch
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async (sid: string) => {
      try {
          setLoading(true)
          const res = await axios.get(`/api/history/${sid}`)
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
    if (!isConnected) {
      setMessages(prev => [...prev, { role: 'assistant', content: '请先连接钱包后再进行查询或操作。' }])
      return
    }

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setSteps([]) 
    setProcessingAction(null)

    try {
      const payload = { 
        message: input,
        sessionId: sessionId || undefined,
        userAddress: isConnected ? address : undefined
      };
      console.log("Sending payload:", payload);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

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
                        setPendingTool(data.tool)
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
    } catch (error: any) {
      console.error("Chat Error:", error)
      setMessages(prev => [...prev, { role: 'error', content: `Connection failed: ${error.message || 'Unknown error'}` }])
      setProcessingAction(null)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approved: boolean) => {
      setApprovalRequired(false)
      setPendingTool(null)
      setLoading(true) // Resume loading
      setProcessingAction("Processing Approval...") // Manual override for immediate feedback
      
      try {
          const res = await axios.post('/api/approve', {
              sessionId,
              action: approved ? 'APPROVED' : 'REJECTED'
          })
          
          // Handle the response similar to chat (it might return final answer or steps)
          // Ideally the backend continues the stream, but for now it returns a JSON.
          // In a full implementation, /api/approve would also return a stream or trigger one.
          // Based on current server_sdk.ts, it returns { response, steps, status }
          
          const { response, steps: newSteps } = res.data
          
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

  // State to toggle thoughts visibility (optional if we want to collapse all)
  // const [showThoughts, setShowThoughts] = useState(true); // Moved to top

  return (
    <div className="app-container">
      <div className={`sidebar ${showThoughts ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
            <h2>🧠 Agent Reasoning</h2>
            <button className="clear-btn" onClick={() => setSteps([])} title="Clear Thoughts">🗑️</button>
        </div>
        
        {activeJobs.length > 0 && (
             <div className="jobs-panel">
                 <h3>⏳ Active Jobs ({activeJobs.length})</h3>
                 {activeJobs.map(job => (
                     <div key={job.id} className="job-card">
                         <div className="job-type">{job.type}</div>
                         <div className="job-status">
                            {job.status === 'completed' ? '✅ Done' : 
                             job.status === 'failed' ? '❌ Failed' : 
                             `Next: ${new Date(job.executeAt).toLocaleTimeString()}`}
                         </div>
                         {job.payload && job.payload.remaining !== undefined && (
                             <div className="job-progress">Remaining: {job.payload.remaining} runs</div>
                         )}
                     </div>
                 ))}
             </div>
        )}
        
        <div className="steps-container">
          {steps.length === 0 && (
            <div className="empty-state">
               Waiting for tasks...
            </div>
          )}
          {steps.map((step, idx) => (
            <div key={idx} className={`step-item ${step.type} animate-fade-in`}>
              <div className="step-header">
                <span className="step-icon">
                    {step.type === 'thought' && '💭'}
                    {step.type === 'call' && '⚡'}
                    {step.type === 'result' && '✅'}
                    {step.type === 'error' && '❌'}
                </span>
                <span className="step-type-label">
                    {step.type === 'thought' && 'Thinking'}
                    {step.type === 'call' && 'Executing'}
                    {step.type === 'result' && 'Result'}
                    {step.type === 'error' && 'Error'}
                </span>
                <span className="step-time">{new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              
              {step.type === 'thought' && (
                  <div className="step-content typing-effect">{step.content}</div>
              )}
              
              {step.type === 'call' && (
                <div className="step-call-details">
                  <div className="tool-badge">{step.tool}</div>
                  <pre className="tool-args">{JSON.stringify(step.args, null, 2)}</pre>
                </div>
              )}
              
              {step.type === 'result' && (
                <div className="step-result-details">
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
            <div className="header-left">
                <h1>MNEE Payment Agent</h1>
                <div className="status-badge">
                    {sessionId ? <span className="online">● Online ({sessionId.slice(0,6)}...)</span> : <span className="offline">● Offline</span>}
                </div>
            </div>
            <div className="header-right">
                <ConnectButton />
                {!isConnected && (
                    <div className="wallet-hint">Please connect your wallet</div>
                )}
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
                {pendingTool && pendingTool.name === 'request_batch_transfer_input' ? (
                    <div className="approval-card batch-form-card">
                        <h3>📝 Batch Transfer Details</h3>
                        <p>Please enter the recipients and amounts.</p>
                        <form onSubmit={handleBatchSubmit} className="batch-form">
                             {batchFormRows.map((row, idx) => (
                                 <div key={idx} className="batch-row">
                                     <input 
                                         placeholder="0x... Address" 
                                         value={row.to} 
                                         onChange={e => handleBatchFormChange(idx, 'to', e.target.value)}
                                     />
                                     <input 
                                         placeholder="Amount" 
                                         value={row.amount} 
                                         onChange={e => handleBatchFormChange(idx, 'amount', e.target.value)}
                                     />
                                     {batchFormRows.length > 1 && (
                                         <button type="button" className="btn-remove" onClick={() => handleRemoveRow(idx)}>✕</button>
                                     )}
                                 </div>
                             ))}
                             <button type="button" className="btn-add-row" onClick={handleAddRow}>+ Add Row</button>
                             <div className="actions">
                                 <button type="button" className="btn-reject" onClick={() => handleApprove(false)}>Cancel</button>
                                 <button type="submit" className="btn-approve">Submit Input</button>
                             </div>
                        </form>
                    </div>
                ) : (
                <div className="approval-card">
                    <h3>⚠️ High Value Transaction</h3>
                    
                    {pendingTool && (pendingTool.name === 'batch_transfer_mnee' || pendingTool.name === 'batch_transfer_eth') && (
                        <div className="approval-details">
                            <p>Batch Transfer Request:</p>
                            <table>
                                <thead><tr><th>To</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {pendingTool.args.payments.map((p: any, i: number) => (
                                        <tr key={i}><td>{p.to.slice(0,6)}...{p.to.slice(-4)}</td><td>{p.amount}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {pendingTool && (pendingTool.name === 'schedule_recurring_transfer' || pendingTool.name === 'schedule_recurring_swap') && (
                        <div className="approval-details">
                            <p>Recurring Schedule:</p>
                            <ul>
                                <li><strong>Amount:</strong> {pendingTool.args.amount} {pendingTool.name.includes('swap') ? 'ETH' : 'MNEE'}</li>
                                <li><strong>Interval:</strong> Every {pendingTool.args.intervalMinutes} min</li>
                                <li><strong>Count:</strong> {pendingTool.args.count || 5} times</li>
                                <li><strong>Total:</strong> {(parseFloat(pendingTool.args.amount) * (pendingTool.args.count || 5)).toFixed(4)}</li>
                            </ul>
                        </div>
                    )}

                    <p>The agent wants to execute a transaction that exceeds the auto-approval threshold.</p>
                    <div className="actions">
                        <button className="btn-reject" onClick={() => handleApprove(false)}>Reject</button>
                        <button className="btn-approve" onClick={() => handleApprove(true)}>Approve Transaction</button>
                    </div>
                </div>
                )}
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
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#666', marginTop: '5px' }}>v1.0.4 - Added Batch Form</div>
      </div>
    </div>
  )
}

export default App
