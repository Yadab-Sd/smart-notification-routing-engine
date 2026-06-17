package com.yadab.sr.sender.channels;

import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

import java.util.*;

/**
 * Factory for creating and managing notification channels.
 * Follows Open-Close Principle: new channels can be added without modifying existing code.
 *
 * Usage:
 * - Register channels in constructor
 * - Get channel by type: factory.getChannel("EMAIL")
 * - Get all available channels: factory.getAllChannels()
 */
public class ChannelFactory {
    private final Map<String, NotificationChannel> channels;
    private final List<String> channelPriorityOrder;

    /**
     * Initialize factory with available channels.
     * To add new channel: instantiate and register in constructor.
     */
    public ChannelFactory(SesV2Client ses, SnsClient sns, DynamoDbClient dynamodb,
                          String defaultFromAddress, String suppressionTable) {
        this.channels = new HashMap<>();

        // Register available channels
        channels.put("EMAIL", new EmailChannel(ses, defaultFromAddress, dynamodb, suppressionTable));
        channels.put("SMS", new SmsChannel(sns));

        // Future channels (uncomment when implemented):
        // channels.put("PUSH", new PushChannel(fcm));
        // channels.put("WHATSAPP", new WhatsAppChannel(twilioClient));

        // Define fallback priority: EMAIL > SMS > PUSH
        // Email is cheapest and most reliable, try first
        this.channelPriorityOrder = Arrays.asList("EMAIL", "SMS", "PUSH");
    }

    /**
     * Get channel by type identifier.
     * @param channelType "EMAIL", "SMS", "PUSH", etc.
     * @return Channel implementation or null if not found
     */
    public NotificationChannel getChannel(String channelType) {
        if (channelType == null) {
            return null;
        }
        return channels.get(channelType.toUpperCase());
    }

    /**
     * Get all registered channels in priority order.
     * Used for fallback selection.
     * @return List of channels ordered by priority
     */
    public List<NotificationChannel> getAllChannels() {
        List<NotificationChannel> orderedChannels = new ArrayList<>();
        for (String channelType : channelPriorityOrder) {
            NotificationChannel channel = channels.get(channelType);
            if (channel != null) {
                orderedChannels.add(channel);
            }
        }
        return orderedChannels;
    }

    /**
     * Check if channel type is registered.
     */
    public boolean hasChannel(String channelType) {
        return channelType != null && channels.containsKey(channelType.toUpperCase());
    }

    /**
     * Get all registered channel types.
     */
    public Set<String> getAvailableChannelTypes() {
        return channels.keySet();
    }
}
