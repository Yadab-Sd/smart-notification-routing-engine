package com.yadab.sr.analytics.model;

public class MetricsOverviewResponse {
    private long totalEvents;
    private long activeUsers;
    private double avgEngagementRate;
    private double modelAUC;

    public MetricsOverviewResponse() {
    }

    public MetricsOverviewResponse(long totalEvents, long activeUsers, double avgEngagementRate, double modelAUC) {
        this.totalEvents = totalEvents;
        this.activeUsers = activeUsers;
        this.avgEngagementRate = avgEngagementRate;
        this.modelAUC = modelAUC;
    }

    public long getTotalEvents() {
        return totalEvents;
    }

    public void setTotalEvents(long totalEvents) {
        this.totalEvents = totalEvents;
    }

    public long getActiveUsers() {
        return activeUsers;
    }

    public void setActiveUsers(long activeUsers) {
        this.activeUsers = activeUsers;
    }

    public double getAvgEngagementRate() {
        return avgEngagementRate;
    }

    public void setAvgEngagementRate(double avgEngagementRate) {
        this.avgEngagementRate = avgEngagementRate;
    }

    public double getModelAUC() {
        return modelAUC;
    }

    public void setModelAUC(double modelAUC) {
        this.modelAUC = modelAUC;
    }
}
