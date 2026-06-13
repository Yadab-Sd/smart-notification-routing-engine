package com.yadab.sr.sender.channels;

import com.amazonaws.services.lambda.runtime.Context;
import com.yadab.sr.sender.model.UserProfile;

/**
 * Channel selection logic with intelligent fallback.
 * Implements the decision matrix for choosing optimal channel.
 *
 * Priority order:
 * 1. Explicit channel from API request (highest)
 * 2. User's preferred channel from profile
 * 3. Smart fallback based on available contact info
 * 4. Default channel (EMAIL)
 *
 * Fallback strategy:
 * - If requested/preferred channel unavailable, try alternatives
 * - Try channels in priority order: EMAIL > SMS > PUSH
 * - Fail only if NO channel can send to user
 */
public class ChannelSelector {
    private final ChannelFactory factory;

    public ChannelSelector(ChannelFactory factory) {
        this.factory = factory;
    }

    /**
     * Select best channel for given user and request.
     *
     * @param user User profile with contact info and preferences
     * @param requestedChannel Channel explicitly requested in API call (can be null)
     * @param context Lambda context for logging
     * @return ChannelSelectionResult with selected channel and metadata
     */
    public ChannelSelectionResult selectChannel(UserProfile user, String requestedChannel, Context context) {
        ChannelSelectionResult result = new ChannelSelectionResult();

        // 1. Try requested channel first (highest priority)
        if (requestedChannel != null) {
            result.setRequestedChannel(requestedChannel);
            NotificationChannel channel = factory.getChannel(requestedChannel);

            if (channel != null && channel.canSend(user)) {
                context.getLogger().log("Using requested channel: " + requestedChannel);
                result.setChannel(channel);
                result.setFallback(false);
                return result;
            }

            // Requested channel unavailable
            context.getLogger().log("WARNING: Requested channel " + requestedChannel +
                    " unavailable. User missing " + (channel != null ? channel.getRequiredField() : "unknown") +
                    ". Trying fallback...");
            result.setReason("Requested channel unavailable: missing " +
                    (channel != null ? channel.getRequiredField() : "channel not supported"));
        }

        // 2. Try user's preferred channel
        String preferredChannel = user.getPrefs() != null ? user.getPrefs().getChannel() : null;
        if (preferredChannel != null) {
            NotificationChannel channel = factory.getChannel(preferredChannel);

            if (channel != null && channel.canSend(user)) {
                context.getLogger().log("Using user preferred channel: " + preferredChannel +
                        (requestedChannel != null ? " (fallback from " + requestedChannel + ")" : ""));
                result.setChannel(channel);
                result.setFallback(requestedChannel != null); // Only fallback if something was requested
                if (result.isFallback() && result.getReason() == null) {
                    result.setReason("User preference used as fallback");
                }
                return result;
            }

            // User preference unavailable
            context.getLogger().log("WARNING: User preferred channel " + preferredChannel +
                    " unavailable. Trying other channels...");
            if (result.getReason() == null) {
                result.setReason("User preferred channel unavailable");
            }
        }

        // 3. Try all channels in priority order (EMAIL > SMS > PUSH)
        for (NotificationChannel channel : factory.getAllChannels()) {
            if (channel.canSend(user)) {
                context.getLogger().log("Using fallback channel: " + channel.getChannelType() +
                        " (requested: " + requestedChannel + ", preferred: " + preferredChannel + ")");
                result.setChannel(channel);
                result.setFallback(true);
                if (result.getReason() == null) {
                    result.setReason("Fallback to available channel");
                }
                return result;
            }
        }

        // 4. No channel available - FAIL
        context.getLogger().log("ERROR: No valid channel available for user " + user.getUserId());
        throw new IllegalStateException(
                "No valid notification channel available for user " + user.getUserId() +
                        ". Missing contact information for all channels." +
                        " Requested: " + requestedChannel +
                        ", Preferred: " + preferredChannel
        );
    }

    /**
     * Result object containing selected channel and metadata.
     */
    public static class ChannelSelectionResult {
        private NotificationChannel channel;
        private boolean fallback;
        private String requestedChannel;
        private String reason;

        public NotificationChannel getChannel() { return channel; }
        public void setChannel(NotificationChannel channel) { this.channel = channel; }

        public boolean isFallback() { return fallback; }
        public void setFallback(boolean fallback) { this.fallback = fallback; }

        public String getRequestedChannel() { return requestedChannel; }
        public void setRequestedChannel(String requestedChannel) { this.requestedChannel = requestedChannel; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }

        public String getChannelType() {
            return channel != null ? channel.getChannelType() : null;
        }
    }
}
