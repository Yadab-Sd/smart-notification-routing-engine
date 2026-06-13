package com.yadab.sr.sender.channels;

import com.amazonaws.services.lambda.runtime.Context;
import com.yadab.sr.sender.model.UserProfile;

/**
 * Strategy interface for notification delivery channels.
 * Follows Open-Close Principle: open for extension, closed for modification.
 *
 * To add a new channel (e.g., WhatsApp, Push):
 * 1. Implement this interface
 * 2. Register in ChannelFactory
 * 3. No changes to existing code needed
 */
public interface NotificationChannel {
    /**
     * @return Channel type identifier (e.g., "EMAIL", "SMS", "PUSH")
     */
    String getChannelType();

    /**
     * Check if this channel can send to the given user.
     * @param user User profile with contact information
     * @return true if user has required contact info for this channel
     */
    boolean canSend(UserProfile user);

    /**
     * @return Name of required field in user profile (e.g., "email", "phone")
     */
    String getRequiredField();

    /**
     * Send notification via this channel.
     * @param recipient Contact address (email, phone, device token)
     * @param subject Subject line (for channels that support it)
     * @param body Message body (HTML or plain text)
     * @param context Lambda context for logging
     * @throws Exception if sending fails
     */
    void send(String recipient, String subject, String body, Context context) throws Exception;

    /**
     * Get cost per message for this channel (in USD).
     * Used for analytics and optimization.
     * @return Cost in dollars per message
     */
    default double getCostPerMessage() {
        return 0.0;
    }
}
