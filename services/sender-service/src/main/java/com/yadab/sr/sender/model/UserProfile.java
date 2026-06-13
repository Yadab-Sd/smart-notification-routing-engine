package com.yadab.sr.sender.model;

import java.util.HashMap;
import java.util.Map;

/**
 * User profile data model.
 * Represents user contact information and preferences.
 */
public class UserProfile {
    private String userId;
    private String email;
    private String phone;
    private UserPreferences prefs;
    private Map<String, Integer> counters;

    public UserProfile() {
        this.prefs = new UserPreferences();
        this.counters = new HashMap<>();
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public UserPreferences getPrefs() { return prefs; }
    public void setPrefs(UserPreferences prefs) { this.prefs = prefs; }

    public Map<String, Integer> getCounters() { return counters; }
    public void setCounters(Map<String, Integer> counters) { this.counters = counters; }

    /**
     * Check if user has valid contact info for given field.
     */
    public boolean hasContactInfo(String field) {
        if ("email".equals(field)) {
            return email != null && !email.isEmpty();
        } else if ("phone".equals(field)) {
            return phone != null && !phone.isEmpty();
        }
        return false;
    }

    @Override
    public String toString() {
        return "UserProfile{" +
                "userId='" + userId + '\'' +
                ", email='" + email + '\'' +
                ", phone='" + phone + '\'' +
                ", prefs=" + prefs +
                '}';
    }

    /**
     * User preferences model.
     */
    public static class UserPreferences {
        private String channel; // "EMAIL", "SMS", "PUSH"

        public String getChannel() { return channel; }
        public void setChannel(String channel) { this.channel = channel; }

        @Override
        public String toString() {
            return "UserPreferences{channel='" + channel + "'}";
        }
    }
}
