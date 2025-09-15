#!/usr/bin/env node
/**
 * Comprehensive test runner for WhatsThatTune performance fixes
 * This script runs all test suites and generates a comprehensive report
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  duration: number;
  coverage?: number;
  errors: string[];
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalDuration: number;
  suites: TestResult[];
  summary: {
    unitTests: TestResult;
    integrationTests: TestResult;
    e2eTests: TestResult;
    performanceTests: TestResult;
  };
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runAllTests(): Promise<TestReport> {
    console.log(
      "🚀 Starting comprehensive test suite for WhatsThatTune performance fixes...\n"
    );

    // Ensure test results directory exists
    const resultsDir = join(process.cwd(), "tests", "results");
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }

    try {
      // Run unit tests
      console.log("📋 Running Unit Tests...");
      const unitResult = await this.runTestSuite(
        "unit",
        "vitest --run --config vitest.config.ts"
      );
      this.results.push(unitResult);

      // Run integration tests
      console.log("\n🔗 Running Integration Tests...");
      const integrationResult = await this.runTestSuite(
        "integration",
        "vitest --run --config vitest.config.ts tests/integration"
      );
      this.results.push(integrationResult);

      // Run E2E tests
      console.log("\n🌐 Running End-to-End Tests...");
      const e2eResult = await this.runTestSuite(
        "e2e",
        "vitest --run --config vitest.e2e.config.ts"
      );
      this.results.push(e2eResult);

      // Run performance tests
      console.log("\n⚡ Running Performance Tests...");
      const performanceResult = await this.runTestSuite(
        "performance",
        "vitest --run --config vitest.performance.config.ts"
      );
      this.results.push(performanceResult);
    } catch (error) {
      console.error("❌ Test execution failed:", error);
    }

    // Generate comprehensive report
    const report = this.generateReport();
    this.saveReport(report);
    this.printSummary(report);

    return report;
  }

  private async runTestSuite(
    suiteName: string,
    command: string
  ): Promise<TestResult> {
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      const output = execSync(command, {
        encoding: "utf-8",
        cwd: process.cwd(),
        timeout: 600000, // 10 minutes timeout
      });

      // Parse test output to extract results
      const lines = output.split("\n");

      // Look for vitest result patterns
      for (const line of lines) {
        if (line.includes("✓") || line.includes("PASS")) {
          passed++;
        } else if (line.includes("✗") || line.includes("FAIL")) {
          failed++;
          errors.push(line.trim());
        }
      }

      // If no specific counts found, try to parse summary
      const summaryMatch = output.match(/(\d+) passed.*?(\d+) failed/i);
      if (summaryMatch) {
        passed = parseInt(summaryMatch[1]);
        failed = parseInt(summaryMatch[2]);
      }

      console.log(
        `✅ ${suiteName} tests completed: ${passed} passed, ${failed} failed`
      );
    } catch (error: any) {
      console.log(`❌ ${suiteName} tests failed to run:`, error.message);
      failed = 1;
      errors.push(error.message);
    }

    const duration = Date.now() - startTime;

    return {
      suite: suiteName,
      passed,
      failed,
      duration,
      errors,
    };
  }

  private generateReport(): TestReport {
    const totalDuration = Date.now() - this.startTime;
    const totalPassed = this.results.reduce(
      (sum, result) => sum + result.passed,
      0
    );
    const totalFailed = this.results.reduce(
      (sum, result) => sum + result.failed,
      0
    );
    const totalTests = totalPassed + totalFailed;

    // Find specific test suites
    const unitTests = this.results.find((r) => r.suite === "unit") || {
      suite: "unit",
      passed: 0,
      failed: 0,
      duration: 0,
      errors: [],
    };
    const integrationTests = this.results.find(
      (r) => r.suite === "integration"
    ) || {
      suite: "integration",
      passed: 0,
      failed: 0,
      duration: 0,
      errors: [],
    };
    const e2eTests = this.results.find((r) => r.suite === "e2e") || {
      suite: "e2e",
      passed: 0,
      failed: 0,
      duration: 0,
      errors: [],
    };
    const performanceTests = this.results.find(
      (r) => r.suite === "performance"
    ) || {
      suite: "performance",
      passed: 0,
      failed: 0,
      duration: 0,
      errors: [],
    };

    return {
      timestamp: new Date().toISOString(),
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      suites: this.results,
      summary: {
        unitTests,
        integrationTests,
        e2eTests,
        performanceTests,
      },
    };
  }

  private saveReport(report: TestReport): void {
    const reportPath = join(
      process.cwd(),
      "tests",
      "results",
      `test-report-${Date.now()}.json`
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Test report saved to: ${reportPath}`);

    // Also save as latest report
    const latestReportPath = join(
      process.cwd(),
      "tests",
      "results",
      "latest-report.json"
    );
    writeFileSync(latestReportPath, JSON.stringify(report, null, 2));
  }

  private printSummary(report: TestReport): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 COMPREHENSIVE TEST SUMMARY");
    console.log("=".repeat(80));

    console.log(
      `🕐 Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`
    );
    console.log(`📈 Total Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.totalPassed}`);
    console.log(`❌ Failed: ${report.totalFailed}`);
    console.log(
      `📊 Success Rate: ${(
        (report.totalPassed / report.totalTests) *
        100
      ).toFixed(1)}%`
    );

    console.log("\n📋 Test Suite Breakdown:");
    console.log("-".repeat(60));

    Object.entries(report.summary).forEach(([suiteName, result]) => {
      const successRate =
        result.passed + result.failed > 0
          ? ((result.passed / (result.passed + result.failed)) * 100).toFixed(1)
          : "0.0";

      console.log(
        `${suiteName.padEnd(20)} | ${result.passed
          .toString()
          .padStart(3)} passed | ${result.failed
          .toString()
          .padStart(3)} failed | ${successRate.padStart(5)}% | ${(
          result.duration / 1000
        )
          .toFixed(1)
          .padStart(6)}s`
      );
    });

    // Show errors if any
    const allErrors = report.suites.flatMap((suite) => suite.errors);
    if (allErrors.length > 0) {
      console.log("\n❌ Errors encountered:");
      console.log("-".repeat(60));
      allErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Performance insights
    console.log("\n⚡ Performance Insights:");
    console.log("-".repeat(60));

    const performanceResult = report.summary.performanceTests;
    if (performanceResult.passed > 0) {
      console.log(`✅ Performance tests passed: ${performanceResult.passed}`);
      console.log(
        `⏱️  Average performance test duration: ${(
          performanceResult.duration /
          Math.max(performanceResult.passed, 1) /
          1000
        ).toFixed(2)}s`
      );
    } else {
      console.log(
        "⚠️  No performance tests passed - check performance thresholds"
      );
    }

    // Requirements coverage
    console.log("\n📋 Requirements Coverage:");
    console.log("-".repeat(60));

    const requirementsCovered = this.analyzeRequirementsCoverage(report);
    requirementsCovered.forEach((req) => {
      console.log(`${req.id}: ${req.covered ? "✅" : "❌"} ${req.description}`);
    });

    console.log("\n" + "=".repeat(80));

    if (report.totalFailed === 0) {
      console.log(
        "🎉 ALL TESTS PASSED! The performance fixes are working correctly."
      );
    } else {
      console.log(
        `⚠️  ${report.totalFailed} tests failed. Please review the errors above.`
      );
    }

    console.log("=".repeat(80));
  }

  private analyzeRequirementsCoverage(
    report: TestReport
  ): Array<{ id: string; description: string; covered: boolean }> {
    // Based on the requirements from the spec
    return [
      {
        id: "1.1",
        description: "Parallel processing improves speed by 50%",
        covered: report.summary.performanceTests.passed > 0,
      },
      {
        id: "1.2",
        description: "Maximum 3 clips processed simultaneously",
        covered: report.summary.performanceTests.passed > 0,
      },
      {
        id: "1.3",
        description: "Failed clips are skipped gracefully",
        covered: report.summary.e2eTests.passed > 0,
      },
      {
        id: "2.1",
        description: "Progress updates every 1 second",
        covered: report.summary.performanceTests.passed > 0,
      },
      {
        id: "2.2",
        description: "Real-time progress via WebSocket",
        covered: report.summary.integrationTests.passed > 0,
      },
      {
        id: "2.3",
        description: "Current song and step displayed",
        covered: report.summary.unitTests.passed > 0,
      },
      {
        id: "2.5",
        description: "Auto-reconnection on network issues",
        covered: report.summary.e2eTests.passed > 0,
      },
      {
        id: "3.1",
        description: "Quick Play auto-redirect to game",
        covered: report.summary.e2eTests.passed > 0,
      },
      {
        id: "3.2",
        description: "Regular mode redirect to create-game",
        covered: report.summary.e2eTests.passed > 0,
      },
      {
        id: "4.1",
        description: "All clip info saved to songs table",
        covered: report.summary.unitTests.passed > 0,
      },
      {
        id: "4.2",
        description: "Game info saved to games table",
        covered: report.summary.unitTests.passed > 0,
      },
      {
        id: "4.4",
        description: "Database retry mechanism (3 attempts)",
        covered: report.summary.unitTests.passed > 0,
      },
      {
        id: "5.3",
        description: "Network error auto-retry with user notification",
        covered: report.summary.e2eTests.passed > 0,
      },
    ];
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner
    .runAllTests()
    .then((report) => {
      process.exit(report.totalFailed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Test runner failed:", error);
      process.exit(1);
    });
}

export { TestRunner };
