"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { timeEstimationManager } from "../time-estimation";

interface ProgressData {
  type: string;
  current: number;
  total: number | string;
  percentage: number;
  step: string;
  song_title: string;
  timestamp: string;
  estimated_remaining_seconds?: number;
  estimated_remaining_minutes?: number;
  clips_completed?: number;
  successful?: number;
  failed?: number;
  // Enhanced progress tracking fields
  current_video_title?: string;
  processing_stage?: string;
  completed_videos?: Array<{
    title: string;
    status: "success" | "failed";
    error?: string;
  }>;
  remaining_count?: number;
  active_workers?: Array<{
    video_title: string;
    stage: string;
  }>;
}

interface EnhancedProgressData extends ProgressData {
  averageTimePerClip?: number;
  processingRate?: number;
  estimatedCompletionTime?: Date;
  confidence?: number;
}

interface WebSocketMessage {
  type: "connection_established" | "progress_update" | "error";
  data?: ProgressData;
  userId?: string;
  timestamp: string;
  error?: string;
}

interface UseProgressWebSocketOptions {
  userId?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enableTimeEstimation?: boolean;
}

export function useProgressWebSocket(
  options: UseProgressWebSocketOptions = {}
) {
  const {
    userId,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    enableTimeEstimation = true,
  } = options;

  const [progress, setProgress] = useState<EnhancedProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyDisconnected = useRef(false);
  const lastUpdateRef = useRef<Date | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const getWebSocketUrl = useCallback(() => {
    if (!userId) return null;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port =
      process.env.NODE_ENV === "development" ? "3001" : window.location.port;
    return `${protocol}//${host}:${port}/api/progress/websocket?userId=${userId}`;
  }, [userId]);

  const processProgressUpdate = useCallback(
    (progressData: ProgressData): EnhancedProgressData => {
      let enhancedProgress: EnhancedProgressData = { ...progressData };
      if (enableTimeEstimation && userId) {
        try {
          const stats = timeEstimationManager.updateStats(userId, progressData);
          if (stats) {
            const processingStats =
              timeEstimationManager.getProcessingStats(userId);
            if (processingStats) {
              enhancedProgress = {
                ...enhancedProgress,
                averageTimePerClip: processingStats.averageTimePerClip,
                processingRate: processingStats.processingRate,
                estimatedCompletionTime:
                  processingStats.estimatedCompletionTime,
                confidence: processingStats.confidence,
                estimated_remaining_minutes:
                  processingStats.estimatedRemainingMinutes ||
                  progressData.estimated_remaining_minutes,
              };
            }
          }
        } catch (err) {
          console.warn("Time estimation failed:", err);
        }
      }
      return enhancedProgress;
    },
    [enableTimeEstimation, userId]
  );

  const createConnection = useCallback(() => {
    if (!userId || isManuallyDisconnected.current) return;
    const wsUrl = getWebSocketUrl();
    if (!wsUrl) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected for user:", userId);
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          switch (message.type) {
            case "connection_established":
              console.log("WebSocket connection established:", message.userId);
              break;
            case "progress_update":
              if (message.data) {
                const enhancedProgress = processProgressUpdate(message.data);
                setProgress(enhancedProgress);
                lastUpdateRef.current = new Date();
              }
              break;
            case "error":
              setError(message.error || "WebSocket error");
              console.error("WebSocket error message:", message.error);
              break;
            default:
              console.log("Unknown WebSocket message type:", message.type);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        if (
          !isManuallyDisconnected.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current += 1;
          setReconnectAttempts(reconnectAttemptsRef.current);
          console.log(
            `Attempting to reconnect... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            createConnection();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError(
            "최대 재연결 시도 횟수에 도달했습니다. 페이지를 새로고침해 주세요."
          );
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket 연결 오류가 발생했습니다.");
        setIsConnecting(false);
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setError("WebSocket 생성에 실패했습니다.");
      setIsConnecting(false);
    }
  }, [
    userId,
    getWebSocketUrl,
    processProgressUpdate,
    maxReconnectAttempts,
    reconnectInterval,
  ]);

  const disconnect = useCallback(() => {
    isManuallyDisconnected.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setProgress(null);
    setError(null);
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    if (userId && enableTimeEstimation) {
      try {
        timeEstimationManager.clearSession(userId);
      } catch (err) {
        console.warn("Failed to clear time estimation session:", err);
      }
    }
  }, [userId, enableTimeEstimation]);

  const reconnect = useCallback(() => {
    disconnect();
    isManuallyDisconnected.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    setTimeout(createConnection, 100);
  }, [disconnect, createConnection]);

  const fallbackToPolling = useCallback(async () => {
    if (!userId || isConnected) return;
    try {
      const response = await fetch(`/api/progress/${userId}`);
      if (response.ok) {
        const progressData = await response.json();
        const enhancedProgress = processProgressUpdate(progressData);
        setProgress(enhancedProgress);
        lastUpdateRef.current = new Date();
      }
    } catch (err) {
      console.warn("Fallback polling failed:", err);
    }
  }, [userId, isConnected, processProgressUpdate]);

  useEffect(() => {
    if (autoConnect && userId) {
      isManuallyDisconnected.current = false;
      createConnection();
    }
    return () => {
      isManuallyDisconnected.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
    };
  }, [userId, autoConnect]);

  useEffect(() => {
    if (!isConnected && userId && !isConnecting) {
      const pollInterval = setInterval(fallbackToPolling, 2000);
      return () => clearInterval(pollInterval);
    }
  }, [isConnected, userId, isConnecting, fallbackToPolling]);

  const connectionHealth = useCallback(() => {
    if (!lastUpdateRef.current) return "unknown";
    const timeSinceLastUpdate = Date.now() - lastUpdateRef.current.getTime();
    if (timeSinceLastUpdate < 5000) return "excellent";
    if (timeSinceLastUpdate < 15000) return "good";
    if (timeSinceLastUpdate < 30000) return "poor";
    return "stale";
  }, []);

  return {
    progress,
    isConnected,
    isConnecting,
    error,
    reconnectAttempts,
    connectionHealth: connectionHealth(),
    connect: createConnection,
    disconnect,
    reconnect,
    clearProgress: () => setProgress(null),
    clearError: () => setError(null),
    getEstimatedTime: () =>
      userId && enableTimeEstimation
        ? timeEstimationManager.getEstimatedRemainingTime(userId)
        : null,
    getProcessingStats: () =>
      userId && enableTimeEstimation
        ? timeEstimationManager.getProcessingStats(userId)
        : null,
  };
}
