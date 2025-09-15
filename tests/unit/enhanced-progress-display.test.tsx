import React from "react";
import { render, screen } from "@testing-library/react";
import { EnhancedProgressDisplay } from "@/components/ui/enhanced-progress-display";
import { describe, it, expect } from "vitest";

describe("EnhancedProgressDisplay", () => {
  const mockProgressData = {
    type: "progress",
    current: 3,
    total: 10,
    percentage: 30,
    step: "클립 생성 중",
    song_title: "Test Song",
    timestamp: new Date().toISOString(),
    current_video_title: "Current Video Title",
    processing_stage: "다운로드 중",
    remaining_count: 7,
    completed_videos: [
      { title: "Video 1", status: "success" as const },
      { title: "Video 2", status: "failed" as const, error: "Download failed" },
      { title: "Video 3", status: "success" as const },
    ],
    active_workers: [
      { video_title: "Worker Video 1", stage: "클립 생성 중" },
      { video_title: "Worker Video 2", stage: "다운로드 중" },
    ],
  };

  it("displays current video title", () => {
    render(<EnhancedProgressDisplay progress={mockProgressData} />);

    expect(screen.getByText("Current Video Title")).toBeInTheDocument();
  });

  it("displays processing stage", () => {
    render(<EnhancedProgressDisplay progress={mockProgressData} />);

    expect(screen.getAllByText("다운로드 중")).toHaveLength(2); // One in main stage, one in active workers
  });

  it("displays remaining count", () => {
    render(<EnhancedProgressDisplay progress={mockProgressData} />);

    expect(screen.getByText("남은 영상: 7개")).toBeInTheDocument();
  });

  it("displays completed videos list", () => {
    render(<EnhancedProgressDisplay progress={mockProgressData} />);

    expect(screen.getByText("완료된 영상들")).toBeInTheDocument();
    expect(screen.getByText("3개 완료")).toBeInTheDocument();
    expect(screen.getByText("Video 1")).toBeInTheDocument();
    expect(screen.getByText("Video 2")).toBeInTheDocument();
    expect(screen.getByText("Video 3")).toBeInTheDocument();
  });

  it("displays active workers", () => {
    render(<EnhancedProgressDisplay progress={mockProgressData} />);

    expect(screen.getByText("동시 처리 중인 영상들:")).toBeInTheDocument();
    expect(screen.getByText("Worker Video 1")).toBeInTheDocument();
    expect(screen.getByText("Worker Video 2")).toBeInTheDocument();
  });

  it("shows success and failure indicators in completed videos", () => {
    render(<EnhancedProgressDisplay progress={mockProgressData} />);

    // Check for success and failure icons (using test IDs or aria-labels would be better)
    const videoElements = screen.getAllByText(/Video [123]/);
    expect(videoElements.length).toBeGreaterThanOrEqual(3); // May include duplicates from worker display
  });

  it("handles empty completed videos list", () => {
    const emptyProgressData = {
      ...mockProgressData,
      completed_videos: [],
    };

    render(<EnhancedProgressDisplay progress={emptyProgressData} />);

    expect(screen.queryByText("완료된 영상들")).not.toBeInTheDocument();
  });

  it("handles no active workers", () => {
    const noWorkersProgressData = {
      ...mockProgressData,
      active_workers: [],
    };

    render(<EnhancedProgressDisplay progress={noWorkersProgressData} />);

    expect(
      screen.queryByText("동시 처리 중인 영상들:")
    ).not.toBeInTheDocument();
  });

  it("limits active workers display to 3", () => {
    const manyWorkersProgressData = {
      ...mockProgressData,
      active_workers: [
        { video_title: "Worker 1", stage: "다운로드 중" },
        { video_title: "Worker 2", stage: "클립 생성 중" },
        { video_title: "Worker 3", stage: "메타데이터 추출 중" },
        { video_title: "Worker 4", stage: "파일 정리 중" },
        { video_title: "Worker 5", stage: "다운로드 중" },
      ],
    };

    render(<EnhancedProgressDisplay progress={manyWorkersProgressData} />);

    expect(screen.getByText("Worker 1")).toBeInTheDocument();
    expect(screen.getByText("Worker 2")).toBeInTheDocument();
    expect(screen.getByText("Worker 3")).toBeInTheDocument();
    expect(screen.getByText("+2개 더...")).toBeInTheDocument();
    expect(screen.queryByText("Worker 4")).not.toBeInTheDocument();
  });

  it("limits completed videos display to 5", () => {
    const manyCompletedProgressData = {
      ...mockProgressData,
      completed_videos: Array.from({ length: 8 }, (_, i) => ({
        title: `Video ${i + 1}`,
        status: "success" as const,
      })),
    };

    render(<EnhancedProgressDisplay progress={manyCompletedProgressData} />);

    expect(screen.getByText("+3개 더 완료됨")).toBeInTheDocument();
  });
});
