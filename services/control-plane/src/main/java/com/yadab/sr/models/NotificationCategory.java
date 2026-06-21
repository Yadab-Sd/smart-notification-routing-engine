package com.yadab.sr.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationCategory {
    @JsonProperty("categoryId")
    public String categoryId;

    @JsonProperty("organizationId")
    public String organizationId;

    @JsonProperty("displayName")
    public String displayName;

    @JsonProperty("description")
    public String description;

    @JsonProperty("defaultDeliveryMode")
    public String defaultDeliveryMode;

    @JsonProperty("allowedChannels")
    public List<String> allowedChannels;

    @JsonProperty("messageCategory")
    public String messageCategory;

    @JsonProperty("riskClass")
    public String riskClass;

    @JsonProperty("priorityClass")
    public String priorityClass;

    @JsonProperty("businessValue")
    public Double businessValue;

    @JsonProperty("urgency")
    public Double urgency;

    @JsonProperty("maxDelayHours")
    public Integer maxDelayHours;

    @JsonProperty("quietHoursRespect")
    public Boolean quietHoursRespect;

    @JsonProperty("active")
    public Boolean active;

    @JsonProperty("createdAt")
    public String createdAt;

    @JsonProperty("updatedAt")
    public String updatedAt;

    public String pk;
    public String sk;

    public static NotificationCategory fromItem(Map<String, AttributeValue> item) {
        if (item == null || item.isEmpty()) {
            return null;
        }

        NotificationCategory category = new NotificationCategory();
        category.pk = stringValue(item, "pk");
        category.sk = stringValue(item, "sk");
        category.organizationId = stringValue(item, "organizationId");
        if ((category.organizationId == null || category.organizationId.isBlank()) && category.pk != null) {
            category.organizationId = category.pk.startsWith("ORG#") ? category.pk.substring(4) : category.pk;
        }
        category.categoryId = stringValue(item, "categoryId");
        if ((category.categoryId == null || category.categoryId.isBlank()) && category.sk != null) {
            category.categoryId = category.sk.startsWith("CATEGORY#") ? category.sk.substring(9) : category.sk;
        }
        category.displayName = stringValue(item, "displayName");
        category.description = stringValue(item, "description");
        category.defaultDeliveryMode = stringValue(item, "defaultDeliveryMode");
        category.allowedChannels = stringListValue(item, "allowedChannels");
        category.messageCategory = stringValue(item, "messageCategory");
        category.riskClass = stringValue(item, "riskClass");
        category.priorityClass = stringValue(item, "priorityClass");
        category.businessValue = doubleValue(item, "businessValue");
        category.urgency = doubleValue(item, "urgency");
        category.maxDelayHours = intValue(item, "maxDelayHours");
        category.quietHoursRespect = boolValue(item, "quietHoursRespect");
        category.active = boolValue(item, "active");
        category.createdAt = stringValue(item, "createdAt");
        category.updatedAt = stringValue(item, "updatedAt");
        return category;
    }

    public Map<String, AttributeValue> toItem() {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("pk", AttributeValue.builder().s("ORG#" + organizationId).build());
        item.put("sk", AttributeValue.builder().s("CATEGORY#" + categoryId).build());
        item.put("organizationId", AttributeValue.builder().s(organizationId).build());
        item.put("categoryId", AttributeValue.builder().s(categoryId).build());

        putString(item, "displayName", displayName);
        putString(item, "description", description);
        putString(item, "defaultDeliveryMode", defaultDeliveryMode);
        putStringList(item, "allowedChannels", allowedChannels);
        putString(item, "messageCategory", messageCategory);
        putString(item, "riskClass", riskClass);
        putString(item, "priorityClass", priorityClass);
        putDouble(item, "businessValue", businessValue);
        putDouble(item, "urgency", urgency);
        putInt(item, "maxDelayHours", maxDelayHours);
        putBool(item, "quietHoursRespect", quietHoursRespect);
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

    private static List<String> stringListValue(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        if (value == null || value.l() == null) {
            return null;
        }
        List<String> values = new ArrayList<>();
        for (AttributeValue entry : value.l()) {
            if (entry.s() != null) {
                values.add(entry.s());
            }
        }
        return values;
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

    private static void putStringList(Map<String, AttributeValue> item, String key, List<String> values) {
        if (values != null && !values.isEmpty()) {
            item.put(key, AttributeValue.builder()
                    .l(values.stream()
                            .filter(value -> value != null && !value.isBlank())
                            .map(value -> AttributeValue.builder().s(value).build())
                            .toList())
                    .build());
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
