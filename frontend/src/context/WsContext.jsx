import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

const WsContext = createContext(null)

export function WsProvider({ children }) {
  const [lastMessage, setLastMessage] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    try {
      // Use the same host/port as the page so WS goes through Vite's proxy.
      // Vite proxies /ws/* → ws://localhost:8000/ws/*
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsHost = window.location.host  // e.g. localhost:5173
      const wsUrl = `${wsProtocol}//${wsHost}/ws/dashboard`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current)
          reconnectRef.current = null
        }
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setLastMessage(data)
        } catch (_) {}
      }

      ws.onclose = () => {
        setConnected(false)
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (_) {
      reconnectRef.current = setTimeout(connect, 5000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  return (
    <WsContext.Provider value={{ lastMessage, connected }}>
      {children}
    </WsContext.Provider>
  )
}

export const useWs = () => useContext(WsContext)

