import { NextRequest } from "next/server";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { parse } from "url";

// WebSocket 서버 인스턴스 (싱글톤)
let wss: WebSocketServer | null = null;
const clients = new Map<string, Set<any>>(); // userId -> Set of WebSocket connections

// WebSocket 서버 초기화
function initWebSocketServer() {
  if (wss) return wss;

  // HTTP 서버 생성 (Next.js와 별도)
  const server = createServer();
  wss = new WebSocketServer({ server, path: "/api/progress/websocket" });

  wss.on("connection", (ws, request) => {
    const { query } = parse(request.url || "", true);
    const userId = query.userId as string;

    if (!userId) {
      ws.close(1008, "Missing userId parameter");
      return;
    }

    console.log(`WebSocket connected for user: ${userId}`);

    // 클라이언트 등록
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ws);

    // 연결 해제 처리
    ws.on("close", () => {
      console.log(`WebSocket disconnected for user: ${userId}`);
      const userClients = clients.get(userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          clients.delete(userId);
        }
      }
    });

    // 에러 처리
    ws.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });

    // 핑-퐁 (연결 유지)
    ws.on("ping", () => {
      ws.pong();
    });

    // 초기 연결 확인 메시지
    ws.send(
      JSON.stringify({
        type: "connection_established",
        userId,
        timestamp: new Date().toISOString(),
      })
    );
  });

  // 서버 시작 (포트 3001 사용)
  const port = process.env.WEBSOCKET_PORT || 3001;

  server.on("error", (error: any) => {
    if (error.code === "EADDRINUSE") {
      console.log(
        `Port ${port} already in use, WebSocket server already running`
      );
    } else {
      console.error("WebSocket server error:", error);
    }
  });

  server.listen(port, () => {
    console.log(`WebSocket server running on port ${port}`);
  });

  return wss;
}

// 특정 사용자에게 진행률 업데이트 전송
export function broadcastProgress(userId: string, progressData: any) {
  if (!wss) {
    initWebSocketServer();
  }

  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) {
    return false; // 연결된 클라이언트 없음
  }

  const message = JSON.stringify({
    type: "progress_update",
    data: progressData,
    timestamp: new Date().toISOString(),
  });

  let sentCount = 0;
  userClients.forEach((ws) => {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      try {
        ws.send(message);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send progress to user ${userId}:`, error);
        userClients.delete(ws);
      }
    } else {
      // 연결이 끊어진 클라이언트 제거
      userClients.delete(ws);
    }
  });

  return sentCount > 0;
}

// 모든 클라이언트에게 메시지 전송
export function broadcastToAll(message: any) {
  if (!wss) return;

  const messageStr = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((userClients, userId) => {
    userClients.forEach((ws) => {
      if (ws.readyState === 1) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error(`Failed to broadcast to user ${userId}:`, error);
        }
      }
    });
  });
}

// Next.js API 핸들러 (WebSocket 서버 초기화용)
export async function GET(request: NextRequest) {
  // WebSocket 서버 초기화
  initWebSocketServer();

  return new Response(
    JSON.stringify({
      message: "WebSocket server initialized",
      port: process.env.WEBSOCKET_PORT || 3001,
      path: "/api/progress/websocket",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

// 진행률 업데이트 API (WebSocket으로 브로드캐스트)
export async function POST(request: NextRequest) {
  try {
    const { userId, progressData } = await request.json();

    if (!userId || !progressData) {
      return new Response(
        JSON.stringify({
          error: "Missing userId or progressData",
        }),
        { status: 400 }
      );
    }

    // WebSocket으로 실시간 전송
    const sent = broadcastProgress(userId, progressData);

    // 기존 progress store에도 저장 (폴백용)
    const { progressStore } = require("@/lib/progress-store");
    progressStore.set(userId, progressData);

    return new Response(
      JSON.stringify({
        success: true,
        websocketSent: sent,
        message: sent
          ? "Progress sent via WebSocket"
          : "No WebSocket clients, stored in memory",
      })
    );
  } catch (error) {
    console.error("Progress WebSocket API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process progress update",
      }),
      { status: 500 }
    );
  }
}
