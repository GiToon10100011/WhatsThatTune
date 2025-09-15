"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface PerformanceSummary {
  date: string;
  total_sessions: number;
  total_steps: number;
  average_success_rate: number;
  average_session_duration: number;
  performance_issues_count: number;
  step_type_performance: Record<
    string,
    {
      total_operations: number;
      average_duration: number;
      success_rate: number;
    }
  >;
}

interface SessionMetrics {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    totalProcessingTime: number;
  };
  metadata?: {
    databaseMetrics?: {
      totalQueries: number;
      successfulQueries: number;
      failedQueries: number;
      averageQueryTime: number;
      slowQueries: number;
      retryCount: number;
    };
    performanceIssues?: Array<{
      type: string;
      description: string;
      severity: "low" | "medium" | "high";
    }>;
  };
}

export function PerformanceDashboard() {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [sessions, setSessions] = useState<SessionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const fetchPerformanceData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch performance summary
      const summaryResponse = await fetch(
        `/api/metrics/performance?type=summary&date=${selectedDate}`
      );
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.data);
      }

      // Fetch session metrics
      const sessionsResponse = await fetch(
        `/api/metrics/session?date=${selectedDate}`
      );
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        setSessions(sessionsData.data || []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch performance data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedDate]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getPerformanceGrade = (successRate: number, avgDuration: number) => {
    if (successRate >= 0.95 && avgDuration <= 5000)
      return { grade: "Excellent", color: "bg-green-500" };
    if (successRate >= 0.9 && avgDuration <= 10000)
      return { grade: "Good", color: "bg-blue-500" };
    if (successRate >= 0.8 && avgDuration <= 20000)
      return { grade: "Fair", color: "bg-yellow-500" };
    return { grade: "Poor", color: "bg-red-500" };
  };

  const getSeverityIcon = (severity: "low" | "medium" | "high") => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading performance data...
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error loading performance data: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          <Button onClick={fetchPerformanceData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_sessions}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_steps} total steps
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(summary.average_success_rate * 100).toFixed(1)}%
              </div>
              <Progress
                value={summary.average_success_rate * 100}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Session Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(summary.average_session_duration)}
              </div>
              <p className="text-xs text-muted-foreground">Per session</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Performance Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {summary.performance_issues_count}
              </div>
              <p className="text-xs text-muted-foreground">Issues detected</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="step-performance">Step Performance</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle>Step Type Performance</CardTitle>
                <CardDescription>
                  Performance breakdown by processing step type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(summary.step_type_performance).map(
                    ([stepType, perf]) => {
                      const { grade, color } = getPerformanceGrade(
                        perf.success_rate,
                        perf.average_duration
                      );
                      return (
                        <div
                          key={stepType}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${color}`} />
                            <div>
                              <div className="font-medium capitalize">
                                {stepType.replace("_", " ")}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {perf.total_operations} operations
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{grade}</Badge>
                            <div className="text-sm text-muted-foreground mt-1">
                              {formatDuration(perf.average_duration)} avg
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="step-performance" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(summary.step_type_performance).map(
                ([stepType, perf]) => (
                  <Card key={stepType}>
                    <CardHeader>
                      <CardTitle className="capitalize">
                        {stepType.replace("_", " ")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Operations:</span>
                        <span className="font-medium">
                          {perf.total_operations}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Success Rate:</span>
                        <span className="font-medium">
                          {(perf.success_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Duration:</span>
                        <span className="font-medium">
                          {formatDuration(perf.average_duration)}
                        </span>
                      </div>
                      <Progress value={perf.success_rate * 100} />
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card key={session.sessionId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Session {session.sessionId.slice(-8)}
                    </CardTitle>
                    <Badge variant="outline">
                      {session.summary.successfulOperations}/
                      {session.summary.totalOperations} successful
                    </Badge>
                  </div>
                  <CardDescription>
                    User: {session.userId} • Duration:{" "}
                    {formatDuration(session.totalDuration || 0)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Operations
                      </div>
                      <div className="text-lg font-medium">
                        {session.summary.totalOperations}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Success Rate
                      </div>
                      <div className="text-lg font-medium">
                        {(
                          (session.summary.successfulOperations /
                            session.summary.totalOperations) *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Avg Time
                      </div>
                      <div className="text-lg font-medium">
                        {formatDuration(session.summary.averageOperationTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        DB Queries
                      </div>
                      <div className="text-lg font-medium">
                        {session.metadata?.databaseMetrics?.totalQueries || 0}
                      </div>
                    </div>
                  </div>

                  {session.metadata?.performanceIssues &&
                    session.metadata.performanceIssues.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium mb-2">
                          Performance Issues:
                        </div>
                        <div className="space-y-2">
                          {session.metadata.performanceIssues.map(
                            (issue, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 text-sm"
                              >
                                {getSeverityIcon(issue.severity)}
                                <span>{issue.description}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Issues Analysis</CardTitle>
              <CardDescription>
                Detected performance issues and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-muted-foreground">
                  No session data available for analysis.
                </p>
              ) : (
                <div className="space-y-4">
                  {sessions
                    .flatMap((session) =>
                      (session.metadata?.performanceIssues || []).map(
                        (issue, index) => ({
                          ...issue,
                          sessionId: session.sessionId,
                          userId: session.userId,
                          key: `${session.sessionId}-${index}`,
                        })
                      )
                    )
                    .map((issue) => (
                      <div key={issue.key} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {getSeverityIcon(issue.severity)}
                          <span className="font-medium capitalize">
                            {issue.type.replace("_", " ")}
                          </span>
                          <Badge variant="outline" className="ml-auto">
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {issue.description}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Session: {issue.sessionId.slice(-8)} • User:{" "}
                          {issue.userId}
                        </div>
                      </div>
                    ))}

                  {sessions.every(
                    (s) => !s.metadata?.performanceIssues?.length
                  ) && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-lg font-medium">
                        No Performance Issues Detected
                      </p>
                      <p className="text-muted-foreground">
                        All systems are running smoothly!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
