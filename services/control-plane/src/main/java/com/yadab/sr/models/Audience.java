package com.yadab.sr.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Audience {
    @JsonProperty("audienceId")
    public String audienceId;

    @JsonProperty("organizationId")
    public String organizationId;

    @JsonProperty("name")
    public String name;

    @JsonProperty("description")
    public String description;

    @JsonProperty("userIds")
    public List<String> userIds;

    @JsonProperty("active")
    public Boolean active;

    @JsonProperty("createdAt")
    public String createdAt;

    @JsonProperty("updatedAt")
    public String updatedAt;

    public String pk;
    public String sk;

    public static Audience fromItem(Map<String, AttributeValue> item) {
        if (item == null || item.isEmpty()) {
            return null;
        }

        Audience audience = new Audience();
        audience.pk = stringValue(item, "pk");
        audience.sk = stringValue(item, "sk");
        audience.organizationId = stringValue(item, "organizationId");
        if ((audience.organizationId == null || audience.organizationId.isBlank()) && audience.pk != null) {
            audience.organizationId = audience.pk.startsWith("ORG#") ? audience.pk.substring(4) : audience.pk;
        }
        audience.audienceId = stringValue(item, "audienceId");
        if ((audience.audienceId == null || audience.audienceId.isBlank()) && audience.sk != null) {
            audience.audienceId = audience.sk.startsWith("AUDIENCE#") ? audience.sk.substring(9) : audience.sk;
        }
        audience.name = stringValue(item, "name");
        audience.description = stringValue(item, "description");
        audience.userIds = stringListValue(item, "userIds");
        audience.active = boolValue(item, "active");
        audience.createdAt = stringValue(item, "createdAt");
        audience.updatedAt = stringValue(item, "updatedAt");
        return audience;
    }

    public Map<String, AttributeValue> toItem() {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("pk", AttributeValue.builder().s("ORG#" + organizationId).build());
        item.put("sk", AttributeValue.builder().s("AUDIENCE#" + audienceId).build());
        item.put("organizationId", AttributeValue.builder().s(organizationId).build());
        item.put("audienceId", AttributeValue.builder().s(audienceId).build());

        putString(item, "name", name);
        putString(item, "description", description);
        putStringList(item, "userIds", userIds);
        putBool(item, "active", active);
        putString(item, "createdAt", createdAt);
        putString(item, "updatedAt", updatedAt);

        return item;
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

    private static void putBool(Map<String, AttributeValue> item, String key, Boolean value) {
        if (value != null) {
            item.put(key, AttributeValue.builder().bool(value).build());
        }
    }
}
