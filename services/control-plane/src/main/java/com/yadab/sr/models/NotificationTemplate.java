package com.yadab.sr.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationTemplate {
    @JsonProperty("templateId")
    public String templateId;

    @JsonProperty("organizationId")
    public String organizationId;

    @JsonProperty("name")
    public String name;

    @JsonProperty("description")
    public String description;

    @JsonProperty("channel")
    public String channel;

    @JsonProperty("messageCategory")
    public String messageCategory;

    @JsonProperty("subject")
    public String subject;

    @JsonProperty("body")
    public String body;

    @JsonProperty("variables")
    public List<String> variables;

    @JsonProperty("active")
    public Boolean active;

    @JsonProperty("createdAt")
    public String createdAt;

    @JsonProperty("updatedAt")
    public String updatedAt;

    public String pk;
    public String sk;

    public static NotificationTemplate fromItem(Map<String, AttributeValue> item) {
        if (item == null || item.isEmpty()) {
            return null;
        }

        NotificationTemplate template = new NotificationTemplate();
        template.pk = stringValue(item, "pk");
        template.sk = stringValue(item, "sk");
        template.organizationId = stringValue(item, "organizationId");
        if ((template.organizationId == null || template.organizationId.isBlank()) && template.pk != null) {
            template.organizationId = template.pk.startsWith("ORG#") ? template.pk.substring(4) : template.pk;
        }
        template.templateId = stringValue(item, "templateId");
        if ((template.templateId == null || template.templateId.isBlank()) && template.sk != null) {
            template.templateId = template.sk.startsWith("TEMPLATE#") ? template.sk.substring(9) : template.sk;
        }
        template.name = stringValue(item, "name");
        template.description = stringValue(item, "description");
        template.channel = stringValue(item, "channel");
        template.messageCategory = stringValue(item, "messageCategory");
        template.subject = stringValue(item, "subject");
        template.body = stringValue(item, "body");
        template.variables = stringListValue(item, "variables");
        template.active = boolValue(item, "active");
        template.createdAt = stringValue(item, "createdAt");
        template.updatedAt = stringValue(item, "updatedAt");
        return template;
    }

    public Map<String, AttributeValue> toItem() {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("pk", AttributeValue.builder().s("ORG#" + organizationId).build());
        item.put("sk", AttributeValue.builder().s("TEMPLATE#" + templateId).build());
        item.put("organizationId", AttributeValue.builder().s(organizationId).build());
        item.put("templateId", AttributeValue.builder().s(templateId).build());

        putString(item, "name", name);
        putString(item, "description", description);
        putString(item, "channel", channel);
        putString(item, "messageCategory", messageCategory);
        putString(item, "subject", subject);
        putString(item, "body", body);
        putStringList(item, "variables", variables);
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
            List<AttributeValue> cleaned = values.stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(value -> AttributeValue.builder().s(value).build())
                    .toList();
            if (cleaned.isEmpty()) {
                return;
            }
            item.put(key, AttributeValue.builder()
                    .l(cleaned)
                    .build());
        }
    }

    private static void putBool(Map<String, AttributeValue> item, String key, Boolean value) {
        if (value != null) {
            item.put(key, AttributeValue.builder().bool(value).build());
        }
    }
}
