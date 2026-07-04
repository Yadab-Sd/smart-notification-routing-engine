package com.yadab.sr.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.math.BigDecimal;
import java.util.*;

/**
 * User profile model.
 * Represents a user in the notification system with contact info and preferences.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class User {
    @JsonProperty("userId")
    public String userId;

    @JsonProperty("name")
    public String name;

    @JsonProperty("firstName")
    public String firstName;

    @JsonProperty("lastName")
    public String lastName;

    @JsonProperty("email")
    public String email;

    @JsonProperty("phone")
    public String phone;

    @JsonProperty("prefs")
    public UserPreferences prefs;

    @JsonProperty("counters")
    public Counters counters;

    @JsonProperty("lastSeenAt")
    public String lastSeenAt;

    @JsonProperty("createdAt")
    public String createdAt;

    @JsonProperty("createdBy")
    public String createdBy; // "API" or "AUTO_EVENT"

    // Internal DynamoDB fields (not exposed in API)
    public String pk;
    public String sk;

    /**
     * User preferences (channel selection, etc.)
     */
    public static class UserPreferences {
        @JsonProperty("channel")
        public String channel; // "EMAIL", "SMS", "PUSH"

        public UserPreferences() {}

        public UserPreferences(String channel) {
            this.channel = channel;
        }
    }

    /**
     * Event counters for analytics
     */
    public static class Counters {
        @JsonProperty("events")
        public Integer events;

        @JsonProperty("clicks")
        public Integer clicks;

        @JsonProperty("sends")
        public Integer sends;

        public Counters() {
            this.events = 0;
            this.clicks = 0;
            this.sends = 0;
        }
    }

    // Static ObjectMapper for JSON conversion
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    /**
     * Convert DynamoDB item to User object.
     */
    public static User fromItem(Map<String, AttributeValue> item) {
        if (item == null || item.isEmpty()) return null;

        User user = new User();

        // Extract userId from pk (USER#userId -> userId)
        if (item.containsKey("pk") && item.get("pk").s() != null) {
            String pk = item.get("pk").s();
            user.pk = pk;
            user.userId = pk.startsWith("USER#") ? pk.substring(5) : pk;
        }

        if (item.containsKey("sk") && item.get("sk").s() != null) {
            user.sk = item.get("sk").s();
        }

        // Extract display/profile info
        if (item.containsKey("name") && item.get("name").s() != null) {
            user.name = item.get("name").s();
        }

        if (item.containsKey("firstName") && item.get("firstName").s() != null) {
            user.firstName = item.get("firstName").s();
        }

        if (item.containsKey("lastName") && item.get("lastName").s() != null) {
            user.lastName = item.get("lastName").s();
        }

        // Extract contact info
        if (item.containsKey("email") && item.get("email").s() != null) {
            user.email = item.get("email").s();
        }

        if (item.containsKey("phone") && item.get("phone").s() != null) {
            user.phone = item.get("phone").s();
        }

        // Extract preferences
        if (item.containsKey("prefs") && item.get("prefs").hasM()) {
            Map<String, AttributeValue> prefsMap = item.get("prefs").m();
            UserPreferences prefs = new UserPreferences();
            if (prefsMap.containsKey("channel") && prefsMap.get("channel").s() != null) {
                prefs.channel = prefsMap.get("channel").s();
            }
            user.prefs = prefs;
        }

        // Extract counters
        if (item.containsKey("counters") && item.get("counters").hasM()) {
            Map<String, AttributeValue> countersMap = item.get("counters").m();
            Counters counters = new Counters();
            if (countersMap.containsKey("events") && countersMap.get("events").n() != null) {
                counters.events = Integer.parseInt(countersMap.get("events").n());
            }
            if (countersMap.containsKey("clicks") && countersMap.get("clicks").n() != null) {
                counters.clicks = Integer.parseInt(countersMap.get("clicks").n());
            }
            if (countersMap.containsKey("sends") && countersMap.get("sends").n() != null) {
                counters.sends = Integer.parseInt(countersMap.get("sends").n());
            }
            user.counters = counters;
        }

        if (item.containsKey("lastSeenAt") && item.get("lastSeenAt").s() != null) {
            user.lastSeenAt = item.get("lastSeenAt").s();
        }

        if (item.containsKey("createdAt") && item.get("createdAt").s() != null) {
            user.createdAt = item.get("createdAt").s();
        }

        if (item.containsKey("createdBy") && item.get("createdBy").s() != null) {
            user.createdBy = item.get("createdBy").s();
        }

        return user;
    }

    /**
     * Convert User object to DynamoDB item.
     */
    public Map<String, AttributeValue> toItem() {
        Map<String, AttributeValue> item = new HashMap<>();

        // Primary key
        item.put("pk", AttributeValue.builder().s("USER#" + userId).build());
        item.put("sk", AttributeValue.builder().s("PROFILE").build());

        // Display/profile info
        if (name != null && !name.isEmpty()) {
            item.put("name", AttributeValue.builder().s(name).build());
        }
        if (firstName != null && !firstName.isEmpty()) {
            item.put("firstName", AttributeValue.builder().s(firstName).build());
        }
        if (lastName != null && !lastName.isEmpty()) {
            item.put("lastName", AttributeValue.builder().s(lastName).build());
        }

        // Contact info
        if (email != null && !email.isEmpty()) {
            item.put("email", AttributeValue.builder().s(email).build());
        }
        if (phone != null && !phone.isEmpty()) {
            item.put("phone", AttributeValue.builder().s(phone).build());
        }

        // Preferences
        if (prefs != null) {
            Map<String, AttributeValue> prefsMap = new HashMap<>();
            if (prefs.channel != null) {
                prefsMap.put("channel", AttributeValue.builder().s(prefs.channel).build());
            }
            item.put("prefs", AttributeValue.builder().m(prefsMap).build());
        }

        // Counters
        if (counters == null) {
            counters = new Counters();
        }
        Map<String, AttributeValue> countersMap = new HashMap<>();
        countersMap.put("events", AttributeValue.builder().n(String.valueOf(counters.events)).build());
        countersMap.put("clicks", AttributeValue.builder().n(String.valueOf(counters.clicks)).build());
        countersMap.put("sends", AttributeValue.builder().n(String.valueOf(counters.sends)).build());
        item.put("counters", AttributeValue.builder().m(countersMap).build());

        // Timestamps
        if (lastSeenAt != null) {
            item.put("lastSeenAt", AttributeValue.builder().s(lastSeenAt).build());
        }
        if (createdAt != null) {
            item.put("createdAt", AttributeValue.builder().s(createdAt).build());
        }

        // Creation source
        if (createdBy != null) {
            item.put("createdBy", AttributeValue.builder().s(createdBy).build());
        }

        return item;
    }

    /**
     * Validate user has at least one contact method.
     */
    public boolean hasContactInfo() {
        return (email != null && !email.isEmpty()) || (phone != null && !phone.isEmpty());
    }

    /**
     * Get ObjectMapper instance.
     */
    public static ObjectMapper getMapper() {
        return MAPPER;
    }
}
