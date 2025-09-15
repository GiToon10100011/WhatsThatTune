#!/usr/bin/env python3
"""
성능 로깅 및 모니터링 모듈
WhatsThatTune 클립 처리 과정의 단계별 성능을 추적하고 로깅합니다.
"""

import json
import time
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from contextlib import contextmanager

@dataclass
class StepPerformance:
    """단계별 성능 데이터"""
    step_name: str
    step_type: str  # download, clip_generation, metadata_extraction, database_save, file_cleanup
    song_title: str
    start_time: float
    end_time: Optional[float] = None
    duration: Optional[float] = None
    success: bool = False
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class SessionPerformance:
    """세션별 성능 데이터"""
    session_id: str
    user_id: str
    start_time: float
    end_time: Optional[float] = None
    total_duration: Optional[float] = None
    steps: List[StepPerformance] = None
    summary: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.steps is None:
            self.steps = []

class PerformanceLogger:
    """성능 로깅 클래스"""
    
    def __init__(self, session_id: str, user_id: str = "unknown"):
        self.session_id = session_id
        self.user_id = user_id
        self.session = SessionPerformance(
            session_id=session_id,
            user_id=user_id,
            start_time=time.time()
        )
        self.active_steps: Dict[str, StepPerformance] = {}
        self.lock = threading.Lock()
        
    def start_step(self, step_name: str, step_type: str, song_title: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """단계 시작"""
        step_id = f"{step_name}_{song_title}_{int(time.time() * 1000)}"
        
        step = StepPerformance(
            step_name=step_name,
            step_type=step_type,
            song_title=song_title,
            start_time=time.time(),
            metadata=metadata or {}
        )
        
        with self.lock:
            self.active_steps[step_id] = step
            
        # 진행률 정보 출력
        self._output_step_progress("started", step_name, step_type, song_title, metadata)
        
        return step_id
    
    def end_step(self, step_id: str, success: bool = True, error_message: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> Optional[float]:
        """단계 종료"""
        with self.lock:
            if step_id not in self.active_steps:
                print(f"Warning: Step {step_id} not found in active steps")
                return None
                
            step = self.active_steps.pop(step_id)
            step.end_time = time.time()
            step.duration = step.end_time - step.start_time
            step.success = success
            step.error_message = error_message
            
            if metadata:
                step.metadata.update(metadata)
                
            self.session.steps.append(step)
        
        # 진행률 정보 출력
        status = "completed" if success else "failed"
        self._output_step_progress(status, step.step_name, step.step_type, step.song_title, {
            "duration": step.duration,
            "success": success,
            "error": error_message
        })
        
        return step.duration
    
    @contextmanager
    def step_timer(self, step_name: str, step_type: str, song_title: str, metadata: Optional[Dict[str, Any]] = None):
        """컨텍스트 매니저를 사용한 단계 타이밍"""
        step_id = self.start_step(step_name, step_type, song_title, metadata)
        success = False
        error_message = None
        
        try:
            yield
            success = True
        except Exception as e:
            error_message = str(e)
            raise
        finally:
            self.end_step(step_id, success, error_message)
    
    def _output_step_progress(self, status: str, step_name: str, step_type: str, song_title: str, metadata: Optional[Dict[str, Any]] = None):
        """단계별 진행률 정보 출력"""
        progress_info = {
            "type": "step_performance",
            "status": status,
            "step_name": step_name,
            "step_type": step_type,
            "song_title": song_title,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "timestamp": datetime.now().isoformat(),
            **(metadata or {})
        }
        
        print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
    
    def end_session(self) -> SessionPerformance:
        """세션 종료 및 요약 생성"""
        self.session.end_time = time.time()
        self.session.total_duration = self.session.end_time - self.session.start_time
        
        # 요약 통계 생성
        self.session.summary = self._generate_summary()
        
        # 세션 완료 정보 출력
        session_info = {
            "type": "session_performance",
            "status": "completed",
            "session_id": self.session_id,
            "user_id": self.user_id,
            "total_duration": self.session.total_duration,
            "summary": self.session.summary,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"PROGRESS: {json.dumps(session_info, ensure_ascii=False)}")
        
        return self.session
    
    def _generate_summary(self) -> Dict[str, Any]:
        """세션 요약 통계 생성"""
        steps = self.session.steps
        
        if not steps:
            return {
                "total_steps": 0,
                "successful_steps": 0,
                "failed_steps": 0,
                "average_step_time": 0,
                "total_processing_time": 0,
                "step_type_breakdown": {}
            }
        
        successful_steps = [s for s in steps if s.success]
        failed_steps = [s for s in steps if not s.success]
        
        # 단계 타입별 분석
        step_type_breakdown = {}
        for step in steps:
            if step.step_type not in step_type_breakdown:
                step_type_breakdown[step.step_type] = {
                    "count": 0,
                    "successful": 0,
                    "failed": 0,
                    "total_duration": 0,
                    "average_duration": 0,
                    "min_duration": float('inf'),
                    "max_duration": 0
                }
            
            breakdown = step_type_breakdown[step.step_type]
            breakdown["count"] += 1
            breakdown["total_duration"] += step.duration or 0
            
            if step.success:
                breakdown["successful"] += 1
            else:
                breakdown["failed"] += 1
                
            if step.duration:
                breakdown["min_duration"] = min(breakdown["min_duration"], step.duration)
                breakdown["max_duration"] = max(breakdown["max_duration"], step.duration)
        
        # 평균 계산
        for breakdown in step_type_breakdown.values():
            if breakdown["count"] > 0:
                breakdown["average_duration"] = breakdown["total_duration"] / breakdown["count"]
            if breakdown["min_duration"] == float('inf'):
                breakdown["min_duration"] = 0
        
        total_processing_time = sum(s.duration or 0 for s in steps)
        average_step_time = total_processing_time / len(steps) if steps else 0
        
        # 성능 이슈 감지
        performance_issues = []
        
        # 느린 단계 감지
        slow_thresholds = {
            "download": 30.0,  # 30초
            "clip_generation": 5.0,  # 5초
            "metadata_extraction": 1.0,  # 1초
            "database_save": 2.0,  # 2초
            "file_cleanup": 1.0  # 1초
        }
        
        for step_type, breakdown in step_type_breakdown.items():
            threshold = slow_thresholds.get(step_type, 5.0)
            if breakdown["average_duration"] > threshold:
                performance_issues.append({
                    "type": "slow_operation",
                    "step_type": step_type,
                    "average_duration": breakdown["average_duration"],
                    "threshold": threshold,
                    "count": breakdown["count"]
                })
        
        # 높은 실패율 감지
        failure_rate = len(failed_steps) / len(steps) if steps else 0
        if failure_rate > 0.2:  # 20% 이상 실패
            performance_issues.append({
                "type": "high_failure_rate",
                "failure_rate": failure_rate,
                "failed_steps": len(failed_steps),
                "total_steps": len(steps)
            })
        
        return {
            "total_steps": len(steps),
            "successful_steps": len(successful_steps),
            "failed_steps": len(failed_steps),
            "success_rate": len(successful_steps) / len(steps) if steps else 0,
            "failure_rate": failure_rate,
            "average_step_time": average_step_time,
            "total_processing_time": total_processing_time,
            "step_type_breakdown": step_type_breakdown,
            "performance_issues": performance_issues
        }
    
    def get_current_stats(self) -> Dict[str, Any]:
        """현재 세션 통계 조회"""
        completed_steps = self.session.steps
        active_steps = len(self.active_steps)
        
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "session_duration": time.time() - self.session.start_time,
            "completed_steps": len(completed_steps),
            "active_steps": active_steps,
            "successful_steps": len([s for s in completed_steps if s.success]),
            "failed_steps": len([s for s in completed_steps if not s.success])
        }

# 전역 성능 로거 인스턴스
_performance_logger: Optional[PerformanceLogger] = None

def init_performance_logger(session_id: str, user_id: str = "unknown") -> PerformanceLogger:
    """성능 로거 초기화"""
    global _performance_logger
    _performance_logger = PerformanceLogger(session_id, user_id)
    return _performance_logger

def get_performance_logger() -> Optional[PerformanceLogger]:
    """현재 성능 로거 인스턴스 반환"""
    return _performance_logger

def log_step_performance(step_name: str, step_type: str, song_title: str, duration: float, success: bool = True, error_message: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
    """단계별 성능 로깅 (직접 호출용)"""
    if _performance_logger:
        step_id = _performance_logger.start_step(step_name, step_type, song_title, metadata)
        # 시작 시간을 조정하여 duration을 맞춤
        with _performance_logger.lock:
            if step_id in _performance_logger.active_steps:
                _performance_logger.active_steps[step_id].start_time = time.time() - duration
        _performance_logger.end_step(step_id, success, error_message, metadata)

def finalize_performance_logging() -> Optional[SessionPerformance]:
    """성능 로깅 종료"""
    global _performance_logger
    if _performance_logger:
        session = _performance_logger.end_session()
        _performance_logger = None
        return session
    return None

# 편의 함수들
def time_step(step_name: str, step_type: str, song_title: str, metadata: Optional[Dict[str, Any]] = None):
    """데코레이터용 단계 타이밍"""
    if _performance_logger:
        return _performance_logger.step_timer(step_name, step_type, song_title, metadata)
    else:
        from contextlib import nullcontext
        return nullcontext()

def start_step_timing(step_name: str, step_type: str, song_title: str, metadata: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """단계 타이밍 시작"""
    if _performance_logger:
        return _performance_logger.start_step(step_name, step_type, song_title, metadata)
    return None

def end_step_timing(step_id: Optional[str], success: bool = True, error_message: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> Optional[float]:
    """단계 타이밍 종료"""
    if _performance_logger and step_id:
        return _performance_logger.end_step(step_id, success, error_message, metadata)
    return None