export class ResponseMonitor {
  static analysisLog = new Map(); // Store analysis for debugging

  static analyzeResponseQuality(
    message,
    userIntent,
    response,
    toolsUsed,
    context
  ) {
    const analysis = {
      timestamp: new Date().toISOString(),
      message: message.substring(0, 100),
      intent: userIntent.primaryIntent.type,
      confidence: userIntent.primaryIntent.confidence,
      locations: userIntent.locations,
      toolsUsed: toolsUsed,
      responseLength: response.length,
      issues: [],
      score: 0,
      shouldHaveUsedTools: false,
    };

    // Issue Detection
    this.detectIssues(
      analysis,
      message,
      userIntent,
      response,
      toolsUsed,
      context
    );

    // Calculate overall score
    analysis.score = this.calculateQualityScore(
      analysis,
      userIntent,
      response,
      toolsUsed
    );

    // Store for debugging
    this.analysisLog.set(Date.now(), analysis);

    // Clean old entries (keep last 100)
    if (this.analysisLog.size > 100) {
      const oldestKey = Math.min(...this.analysisLog.keys());
      this.analysisLog.delete(oldestKey);
    }

    return analysis;
  }

  static detectIssues(
    analysis,
    message,
    userIntent,
    response,
    toolsUsed,
    context
  ) {
    const lowerMessage = message.toLowerCase();
    const lowerResponse = response.toLowerCase();

    // Issue 1: High-confidence intent with no tools used
    if (userIntent.primaryIntent.confidence > 0.7 && toolsUsed.length === 0) {
      if (userIntent.locations?.length > 0) {
        analysis.issues.push({
          type: "HIGH_CONFIDENCE_NO_TOOLS",
          severity: "HIGH",
          description: `High confidence ${userIntent.primaryIntent.type} with location but no tools used`,
          shouldHaveUsedTools: true,
        });
      }
    }

    // Issue 2: Location-specific query with generic response
    if (userIntent.locations?.length > 0 && toolsUsed.length === 0) {
      const hasLocationSpecificKeywords = [
        "weather",
        "restaurant",
        "hotel",
        "safe",
        "activities",
        "culture",
      ].some((keyword) => lowerMessage.includes(keyword));

      if (hasLocationSpecificKeywords) {
        analysis.issues.push({
          type: "LOCATION_SPECIFIC_NO_TOOLS",
          severity: "HIGH",
          description: `Location-specific query about ${userIntent.locations.join(
            ", "
          )} without using tools`,
          shouldHaveUsedTools: true,
        });
      }
    }

    // Issue 3: Safety query without safety intelligence
    if (
      userIntent.primaryIntent.type === "safety_inquiry" &&
      !toolsUsed.includes("comprehensive_safety_intelligence")
    ) {
      analysis.issues.push({
        type: "SAFETY_NO_INTELLIGENCE",
        severity: "CRITICAL",
        description: "Safety inquiry without using safety intelligence tool",
        shouldHaveUsedTools: true,
      });
    }

    // Issue 4: Weather query without weather data
    if (
      userIntent.primaryIntent.type === "weather_inquiry" &&
      !toolsUsed.includes("comprehensive_weather_analysis")
    ) {
      analysis.issues.push({
        type: "WEATHER_NO_DATA",
        severity: "HIGH",
        description: "Weather inquiry without using weather analysis tool",
        shouldHaveUsedTools: true,
      });
    }

    // Issue 5: Generic response patterns
    const genericPatterns = [
      "i'd be happy to help",
      "here are some general",
      "generally speaking",
      "it depends on",
      "you should consider",
    ];

    const hasGenericPattern = genericPatterns.some((pattern) =>
      lowerResponse.includes(pattern)
    );

    if (
      hasGenericPattern &&
      toolsUsed.length === 0 &&
      userIntent.locations?.length > 0
    ) {
      analysis.issues.push({
        type: "GENERIC_WITH_LOCATION",
        severity: "MEDIUM",
        description: "Generic response for location-specific query",
        shouldHaveUsedTools: true,
      });
    }

    // Issue 6: Multi-tool expected but only one or none used
    if (
      userIntent.multiToolRequirements?.shouldUseMultipleTools &&
      toolsUsed.length < 2
    ) {
      analysis.issues.push({
        type: "MULTI_TOOL_EXPECTED",
        severity: "HIGH",
        description: "Multi-tool analysis expected but not delivered",
        shouldHaveUsedTools: true,
      });
    }

    // Issue 7: Short response for complex query
    if (userIntent.complexity === "high" && response.length < 300) {
      analysis.issues.push({
        type: "COMPLEX_QUERY_SHORT_RESPONSE",
        severity: "MEDIUM",
        description: "Complex query received brief response",
      });
    }

    // Issue 8: No specific recommendations
    const hasRecommendations = [
      "recommend",
      "suggest",
      "should visit",
      "try",
      "consider",
    ].some((word) => lowerResponse.includes(word));

    if (
      !hasRecommendations &&
      userIntent.primaryIntent.type.includes("recommendations")
    ) {
      analysis.issues.push({
        type: "NO_RECOMMENDATIONS",
        severity: "MEDIUM",
        description: "Recommendation request without specific recommendations",
      });
    }

    // Set overall flag
    analysis.shouldHaveUsedTools = analysis.issues.some(
      (issue) => issue.shouldHaveUsedTools
    );
  }

  static calculateQualityScore(analysis, userIntent, response, toolsUsed) {
    let score = 5; // Start with base score

    // Deduct for issues
    analysis.issues.forEach((issue) => {
      switch (issue.severity) {
        case "CRITICAL":
          score -= 3;
          break;
        case "HIGH":
          score -= 2;
          break;
        case "MEDIUM":
          score -= 1;
          break;
      }
    });

    // Add points for good practices
    if (toolsUsed.length > 0) score += 2;
    if (toolsUsed.length > 1) score += 1;
    if (response.length > 500) score += 1;
    if (response.includes("**")) score += 1; // Structured response

    return Math.max(0, Math.min(10, score));
  }

  static generateImprovementSuggestions(analysis, userIntent) {
    const suggestions = [];

    analysis.issues.forEach((issue) => {
      switch (issue.type) {
        case "HIGH_CONFIDENCE_NO_TOOLS":
        case "LOCATION_SPECIFIC_NO_TOOLS":
          suggestions.push({
            type: "FORCE_TOOL_USAGE",
            message: `Should have used tools for ${
              userIntent.primaryIntent.type
            } with location ${userIntent.locations?.join(", ")}`,
            recommendedTool: this.getRecommendedTool(
              userIntent.primaryIntent.type
            ),
          });
          break;

        case "SAFETY_NO_INTELLIGENCE":
          suggestions.push({
            type: "USE_SAFETY_TOOL",
            message:
              "Safety queries must use comprehensive_safety_intelligence",
            recommendedTool: "comprehensive_safety_intelligence",
          });
          break;

        case "WEATHER_NO_DATA":
          suggestions.push({
            type: "USE_WEATHER_TOOL",
            message: "Weather queries must use comprehensive_weather_analysis",
            recommendedTool: "comprehensive_weather_analysis",
          });
          break;

        case "MULTI_TOOL_EXPECTED":
          suggestions.push({
            type: "USE_MULTIPLE_TOOLS",
            message: "Complex queries require multiple tool analysis",
            recommendedTools: this.getMultiToolRecommendations(userIntent),
          });
          break;

        case "GENERIC_WITH_LOCATION":
          suggestions.push({
            type: "AVOID_GENERIC_RESPONSES",
            message:
              "Provide specific, location-based intelligence instead of generic advice",
          });
          break;
      }
    });

    return suggestions;
  }

  static getRecommendedTool(intentType) {
    const mapping = {
      safety_inquiry: "comprehensive_safety_intelligence",
      weather_inquiry: "comprehensive_weather_analysis",
      dining_recommendations: "intelligent_restaurant_discovery",
      accommodation_search: "smart_accommodation_finder",
      cultural_inquiry: "cultural_and_travel_insights",
      activity_recommendations: "local_experiences_and_attractions",
      destination_planning: "cultural_and_travel_insights",
    };
    return mapping[intentType] || "cultural_and_travel_insights";
  }

  static getMultiToolRecommendations(userIntent) {
    const tools = [];

    if (userIntent.locations?.length > 0) {
      // Always include cultural context for destination queries
      tools.push("cultural_and_travel_insights");

      // Add safety for travel planning
      if (userIntent.primaryIntent.type === "destination_planning") {
        tools.push("comprehensive_safety_intelligence");
      }

      // Add weather for outdoor activities
      if (userIntent.primaryIntent.type === "activity_recommendations") {
        tools.push("comprehensive_weather_analysis");
      }
    }

    return tools;
  }

  static shouldRetryWithCorrection(analysis, userIntent) {
    // Retry if critical issues found
    const hasCriticalIssues = analysis.issues.some(
      (issue) => issue.severity === "CRITICAL"
    );

    // Retry if score is very low and tools should have been used
    const lowScoreWithToolsNeeded =
      analysis.score < 3 && analysis.shouldHaveUsedTools;

    // Retry if high-confidence location query got generic response
    const highConfidenceLocationGeneric =
      userIntent.primaryIntent.confidence > 0.8 &&
      userIntent.locations?.length > 0 &&
      analysis.issues.some(
        (issue) => issue.type === "LOCATION_SPECIFIC_NO_TOOLS"
      );

    return (
      hasCriticalIssues ||
      lowScoreWithToolsNeeded ||
      highConfidenceLocationGeneric
    );
  }

  static generateCorrectedToolChoice(analysis, userIntent) {
    const suggestions = this.generateImprovementSuggestions(
      analysis,
      userIntent
    );

    // Find tool suggestion
    const toolSuggestion = suggestions.find((s) => s.recommendedTool);
    if (toolSuggestion) {
      return {
        type: "function",
        function: { name: toolSuggestion.recommendedTool },
      };
    }

    // Find multi-tool suggestion
    const multiToolSuggestion = suggestions.find((s) => s.recommendedTools);
    if (multiToolSuggestion) {
      return "required"; // Force multiple tools
    }

    // Default correction
    if (userIntent.locations?.length > 0) {
      return {
        type: "function",
        function: {
          name: this.getRecommendedTool(userIntent.primaryIntent.type),
        },
      };
    }

    return "auto";
  }

  static getAnalyticsReport() {
    const analyses = Array.from(this.analysisLog.values());
    if (analyses.length === 0) return null;

    const report = {
      total_responses: analyses.length,
      average_score:
        analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length,
      issue_frequency: {},
      tool_usage: {},
      intent_performance: {},
    };

    // Analyze issue frequency
    analyses.forEach((analysis) => {
      analysis.issues.forEach((issue) => {
        report.issue_frequency[issue.type] =
          (report.issue_frequency[issue.type] || 0) + 1;
      });
    });

    // Analyze tool usage
    analyses.forEach((analysis) => {
      const toolCount = analysis.toolsUsed.length;
      report.tool_usage[toolCount] = (report.tool_usage[toolCount] || 0) + 1;
    });

    // Analyze performance by intent
    analyses.forEach((analysis) => {
      if (!report.intent_performance[analysis.intent]) {
        report.intent_performance[analysis.intent] = {
          count: 0,
          total_score: 0,
          issues: 0,
        };
      }
      report.intent_performance[analysis.intent].count++;
      report.intent_performance[analysis.intent].total_score += analysis.score;
      report.intent_performance[analysis.intent].issues +=
        analysis.issues.length;
    });

    // Calculate averages
    Object.keys(report.intent_performance).forEach((intent) => {
      const perf = report.intent_performance[intent];
      perf.average_score = perf.total_score / perf.count;
      perf.average_issues = perf.issues / perf.count;
    });

    return report;
  }

  static logQualityIssue(issue, requestId) {
    console.warn(
      `Quality Issue [${requestId}]: ${issue.type} - ${issue.description}`
    );
  }

  static logResponseAnalysis(analysis, requestId) {
    if (analysis.issues.length > 0) {
      console.warn(`Response Analysis [${requestId}]:`);
      console.warn(`  Score: ${analysis.score}/10`);
      console.warn(`  Issues: ${analysis.issues.length}`);
      analysis.issues.forEach((issue) => {
        console.warn(`    - ${issue.type}: ${issue.description}`);
      });

      if (analysis.shouldHaveUsedTools) {
        console.warn(
          `  Recommendation: Should have used tools for better response quality`
        );
      }
    } else {
      console.log(
        `Response Analysis [${requestId}]: Score ${analysis.score}/10 - No issues detected`
      );
    }
  }
}
