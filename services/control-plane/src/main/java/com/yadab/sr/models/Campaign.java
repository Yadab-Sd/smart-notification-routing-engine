package com.yadab.sr.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.util.HashMap;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Campaign {
    @JsonProperty("campaignId")
    public String campaignId;

    @JsonProperty("organizationId")
    public String organizationId;

    @JsonProperty("name")
    public String name;

    @JsonProperty("description")
    public String description;

    @JsonProperty("categoryId")
    public String categoryId;

    @JsonProperty("eventType")
    public String eventType;

    @JsonProperty("subject")
    public String subject;

    @JsonProperty("message")
    public String message;

    @JsonProperty("channel")
    public String channel;

    @JsonProperty("messageCategory")
    public String messageCategory;

    @JsonProperty("priorityClass")
    public String priorityClass;

    @JsonProperty("businessValue")
    public Double businessValue;

    @JsonProperty("urgency")
    public Double urgency;

    @JsonProperty("maxDelayHours")
    public Integer maxDelayHours;

    @JsonProperty("defaultDeliveryMode")
    public String defaultDeliveryMode;

    @JsonProperty("active")
    public Boolean active;

    @JsonProperty("createdAt")
    public String createdAt;

    @JsonProperty("updatedAt")
    public String updatedAt;

    public String pk;
    public String sk;

    public static Campaign fromItem(Map<String, AttributeValue> item) {
        if (item == null || item.isEmpty()) {
            return null;
        }

        Campaign campaign = new Campaign();
        campaign.pk = stringValue(item, "pk");
        campaign.sk = stringValue(item, "sk");
        campaign.organizationId = stringValue(item, "organizationId");
        if ((campaign.organizationId == null || campaign.organizationId.isBlank()) && campaign.pk != null) {
            campaign.organizationId = campaign.pk.startsWith("ORG#") ? campaign.pk.substring(4) : campaign.pk;
        }
        campaign.campaignId = stringValue(item, "campaignId");
        if ((campaign.campaignId == null || campaign.campaignId.isBlank()) && campaign.sk != null) {
            campaign.campaignId = campaign.sk.startsWith("CAMPAIGN#") ? campaign.sk.substring(9) : campaign.sk;
        }
        campaign.name = stringValue(item, "name");
        campaign.description = stringValue(item, "description");
        campaign.categoryId = stringValue(item, "categoryId");
        campaign.eventType = stringValue(item, "eventType");
        campaign.subject = stringValue(item, "subject");
        campaign.message = stringValue(item, "message");
        campaign.channel = stringValue(item, "channel");
        campaign.messageCategory = stringValue(item, "messageCategory");
        campaign.priorityClass = stringValue(item, "priorityClass");
        campaign.businessValue = doubleValue(item, "businessValue");
        campaign.urgency = doubleValue(item, "urgency");
        campaign.maxDelayHours = intValue(item, "maxDelayHours");
        campaign.defaultDeliveryMode = stringValue(item, "defaultDeliveryMode");
        campaign.active = boolValue(item, "active");
        campaign.createdAt = stringValue(item, "createdAt");
        campaign.updatedAt = stringValue(item, "updatedAt");
        return campaign;
    }

    public Map<String, AttributeValue> toItem() {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("pk", AttributeValue.builder().s("ORG#" + organizationId).build());
        item.put("sk", AttributeValue.builder().s("CAMPAIGN#" + campaignId).build());
        item.put("organizationId", AttributeValue.builder().s(organizationId).build());
        item.put("campaignId", AttributeValue.builder().s(campaignId).build());

        putString(item, "name", name);
        putString(item, "description", description);
        putString(item, "categoryId", categoryId);
        putString(item, "eventType", eventType);
        putString(item, "subject", subject);
        putString(item, "message", message);
        putString(item, "channel", channel);
        putString(item, "messageCategory", messageCategory);
        putString(item, "priorityClass", priorityClass);
        putDouble(item, "businessValue", businessValue);
        putDouble(item, "urgency", urgency);
        putInt(item, "maxDelayHours", maxDelayHours);
        putString(item, "defaultDeliveryMode", defaultDeliveryMode);
        putBool(item, "active", active);
        putString(item, "createdAt", createdAt);
        putString(item, "updatedAt", updatedAt);

        return item;
    }

    public boolean isActive() {
        return active == null || active;
    }

    private static String stringValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.s() != null ? value.s() : null;
    }

    private static Double doubleValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.n() != null ? Double.parseDouble(value.n()) : null;
    }

    private static Integer intValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.n() != null ? Integer.parseInt(value.n()) : null;
    }

    private static Boolean boolValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.bool() != null ? value.bool() : null;
    }

    private static void putString(Map<String, AttributeValue> item, String key, String value) {
        if (value != null && !value.isBlank()) {
            item.put(key, AttributeValue.builder().s(value).build());
        }
    }

    private static void putDouble(Map<String, AttributeValue> item, String key, Double value) {
        if (value != null) {
            item.put(key, AttributeValue.builder().n(String.valueOf(value)).build());
        }
    }

    private static void putInt(Map<String, AttributeValue> item, String key, Integer value) {
        if (value != null) {
            item.put(key, AttributeValue.builder().n(String.valueOf(value)).build());
        }
    }

    private static void putBool(Map<String, AttributeValue> item, String key, Boolean value) {
        if (value != null) {
            item.put(key, AttributeValue.builder().bool(value).build());
        }
    }
}
