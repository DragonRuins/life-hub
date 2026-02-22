/**
 * useChat.js - Custom hook for AI chat state and logic
 *
 * Shared by both Catppuccin (ChatWidget) and LCARS (LCARSChatTerminal).
 * Handles conversation management, SSE streaming, and message state.
 *
 * SSE streaming flow:
 *   1. User sends message -> added to local state immediately
 *   2. POST /api/ai/chat with conversation_id and message
 *   3. Read response as SSE stream (text/event-stream)
 *   4. Parse events: text_delta, tool_use, tool_result, message_stop, error
 *   5. On completion, finalize message in state
 */
import { useState, useCallback, useRef } from 'react'
import { ai } from '../api/client'

export default function useChat() {
  // ── State ──────────────────────────────────────────────────
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [toolStatus, setToolStatus] = useState(null) // e.g., "Searching vehicles..."
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState(null)
  const [showThreadList, setShowThreadList] = useState(false)

  // Ref to abort ongoing streams
  const abortRef = useRef(null)

  // ── Actions ────────────────────────────────────────────────

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const loadConversations = useCallback(async () => {
    try {
      const data = await ai.conversations.list()
      setConversations(data)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  }, [])

  const selectConversation = useCallback(async (id) => {
    try {
      const data = await ai.conversations.get(id)
      setActiveConversation(data)
      setShowThreadList(false)
      setError(null)
    } catch (err) {
      setError('Failed to load conversation')
    }
  }, [])

  const startNewConversation = useCallback(() => {
    setActiveConversation(null)
    setStreamingText('')
    setToolStatus(null)
    setError(null)
    setShowThreadList(false)
  }, [])

  const deleteConversation = useCallback(async (id) => {
    try {
      await ai.conversations.delete(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      // If we deleted the active conversation, clear it
      if (activeConversation?.id === id) {
        setActiveConversation(null)
      }
    } catch (err) {
      setError('Failed to delete conversation')
    }
  }, [activeConversation])

  const renameConversation = useCallback(async (id, title) => {
    try {
      await ai.conversations.update(id, { title })
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, title } : c)
      )
      if (activeConversation?.id === id) {
        setActiveConversation(prev => ({ ...prev, title }))
      }
    } catch (err) {
      setError('Failed to rename conversation')
    }
  }, [activeConversation])

  /**
   * Send a user message and stream the AI response via SSE.
   */
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return

    setError(null)
    setIsStreaming(true)
    setStreamingText('')
    setToolStatus(null)

    // Optimistically add user message to UI
    const userMessage = {
      id: Date.now(), // temporary ID
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }

    setActiveConversation(prev => {
      if (prev) {
        return {
          ...prev,
          messages: [...(prev.messages || []), userMessage],
        }
      }
      // New conversation — title will be AI-generated after first response
      return {
        id: null,
        title: text.slice(0, 40),
        messages: [userMessage],
      }
    })

    try {
      const abortController = new AbortController()
      abortRef.current = abortController

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversation?.id || null,
          message: text,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Read SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events (delimited by \n\n)
        const events = buffer.split('\n\n')
        // Keep the last incomplete chunk in the buffer
        buffer = events.pop() || ''

        for (const event of events) {
          if (!event.trim()) continue

          // Parse SSE "data: {...}" lines
          const lines = event.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6) // Remove "data: " prefix

            try {
              const data = JSON.parse(jsonStr)

              switch (data.type) {
                case 'text_delta':
                  accumulatedText += data.text
                  setStreamingText(accumulatedText)
                  break

                case 'tool_use': {
                  // Map tool names to friendly descriptions
                  const toolLabels = {
                    search_vehicles: 'Searching vehicles...',
                    get_vehicle_detail: 'Looking up vehicle details...',
                    search_notes: 'Searching notes...',
                    get_note: 'Reading note...',
                    search_projects: 'Searching projects...',
                    get_project_detail: 'Loading project details...',
                    search_knowledge_base: 'Searching knowledge base...',
                    get_maintenance_history: 'Checking maintenance history...',
                    get_fuel_stats: 'Calculating fuel statistics...',
                    get_infrastructure_overview: 'Checking infrastructure...',
                    get_dashboard_summary: 'Loading dashboard summary...',
                  }
                  setToolStatus(toolLabels[data.tool] || `Using ${data.tool}...`)
                  break
                }

                case 'tool_result':
                  setToolStatus(null)
                  break

                case 'message_stop': {
                  // Finalize: move accumulated text into messages
                  const finalText = accumulatedText
                  const conversationId = data.conversation_id
                  const newTitle = data.title

                  setActiveConversation(prev => {
                    const assistantMsg = {
                      id: Date.now() + 1,
                      role: 'assistant',
                      content: finalText,
                      token_count: data.token_count,
                      created_at: new Date().toISOString(),
                    }
                    return {
                      ...prev,
                      id: conversationId || prev?.id,
                      title: newTitle || prev?.title,
                      messages: [...(prev?.messages || []), assistantMsg],
                    }
                  })

                  // Update conversations list
                  loadConversations()
                  break
                }

                case 'error':
                  setError(data.error)
                  break
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled — not an error
      } else {
        setError(err.message || 'Failed to send message')
      }
    } finally {
      setIsStreaming(false)
      setStreamingText('')
      setToolStatus(null)
      abortRef.current = null
    }
  }, [activeConversation, isStreaming, loadConversations])

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }, [])

  return {
    // State
    conversations,
    activeConversation,
    isStreaming,
    streamingText,
    toolStatus,
    isOpen,
    error,
    showThreadList,
    // Actions
    toggle,
    open,
    close,
    loadConversations,
    selectConversation,
    startNewConversation,
    sendMessage,
    deleteConversation,
    renameConversation,
    stopStreaming,
    setError,
    setShowThreadList,
  }
}
