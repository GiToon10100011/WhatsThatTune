#!/usr/bin/env node
/**
 * WebSocket 서버 시작 스크립트
 * 개발 환경에서 WebSocket 서버를 별도로 실행하기 위한 스크립트
 */

const { WebSocketServer } = require("ws");
const { createServer } = require("http");
const { parse } = require("url");

// 클라이언트 연결 관리
const clients = new Map(); // userId -> Set of WebSocket connections

// HTTP 서버 생성
const server = createServer();
const wss = new WebSocketServer({ server, path: "/api/progress/websocket" });

console.log("Starting WebSocket server...");

wss.on("connection", (ws, request) => {
  const { query } = parse(request.url || "", true);
  const userId = query.userId;

  if (!userId) {
    ws.close(1008, "Missing userId parameter");
    return;
  }

  console.log(`WebSocket connected for user: ${userId}`);

  // 클라이언트 등록
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(ws);

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

// 서버 시작
const port = process.env.WEBSOCKET_PORT || 3001;
server.listen(port, () => {
  console.log(`WebSocket server running on port ${port}`);
  console.log(`WebSocket URL: ws://localhost:${port}/api/progress/websocket`);
});

// 프로세스 종료 처리
process.on("SIGINT", () => {
  console.log("\nShutting down WebSocket server...");
  wss.close(() => {
    server.close(() => {
      console.log("WebSocket server closed");
      process.exit(0);
    });
  });
});

// 진행률 브로드캐스트 함수 (외부에서 호출 가능)
function broadcastProgress(userId, progressData) {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) {
    return false;
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
      userClients.delete(ws);
    }
  });

  return sentCount > 0;
}

// HTTP API 엔드포인트 (진행률 업데이트용)
server.on("request", (req, res) => {
  const { pathname } = parse(req.url || "", true);

  if (pathname === "/api/progress/websocket" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const { userId, progressData } = JSON.parse(body);

        if (!userId || !progressData) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing userId or progressData" }));
          return;
        }

        const sent = broadcastProgress(userId, progressData);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            websocketSent: sent,
            connectedClients: clients.get(userId)?.size || 0,
          })
        );
      } catch (error) {
        console.error("Error processing progress update:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to process progress update" }));
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

module.exports = { broadcastProgress };
