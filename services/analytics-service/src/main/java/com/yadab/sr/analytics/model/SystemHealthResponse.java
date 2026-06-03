package com.yadab.sr.analytics.model;

public class SystemHealthResponse {
    private ApiLatency apiLatency;
    private double errorRate;
    private long lambdaInvocations;
    private long kinesisLag;
    private long sagemakerInferences;
    private long notificationsSent;

    public static class ApiLatency {
        private int p50;
        private int p95;
        private int p99;

        public ApiLatency() {
        }

        public ApiLatency(int p50, int p95, int p99) {
            this.p50 = p50;
            this.p95 = p95;
            this.p99 = p99;
        }

        public int getP50() {
            return p50;
        }

        public void setP50(int p50) {
            this.p50 = p50;
        }

        public int getP95() {
            return p95;
        }

        public void setP95(int p95) {
            this.p95 = p95;
        }

        public int getP99() {
            return p99;
        }

        public void setP99(int p99) {
            this.p99 = p99;
        }
    }

    public SystemHealthResponse() {
    }

    public ApiLatency getApiLatency() {
        return apiLatency;
    }

    public void setApiLatency(ApiLatency apiLatency) {
        this.apiLatency = apiLatency;
    }

    public double getErrorRate() {
        return errorRate;
    }

    public void setErrorRate(double errorRate) {
        this.errorRate = errorRate;
    }

    public long getLambdaInvocations() {
        return lambdaInvocations;
    }

    public void setLambdaInvocations(long lambdaInvocations) {
        this.lambdaInvocations = lambdaInvocations;
    }

    public long getKinesisLag() {
        return kinesisLag;
    }

    public void setKinesisLag(long kinesisLag) {
        this.kinesisLag = kinesisLag;
    }

    public long getSagemakerInferences() {
        return sagemakerInferences;
    }

    public void setSagemakerInferences(long sagemakerInferences) {
        this.sagemakerInferences = sagemakerInferences;
    }

    public long getNotificationsSent() {
        return notificationsSent;
    }

    public void setNotificationsSent(long notificationsSent) {
        this.notificationsSent = notificationsSent;
    }
}
