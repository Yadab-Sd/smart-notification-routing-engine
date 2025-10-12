package com.yadab.sr.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@JsonIgnoreProperties(ignoreUnknown = true)
public class User {
    public String pk;
    public String sk;
    public String lastSeenAt;
    public Counters counters;

    public static class Counters {
        public Integer events;
    }

    // static, reused mapper
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    /**
     * Convert a DynamoDB AttributeValue (any type) into a plain Java object:
     * - String -> String
     * - Number -> Integer (if integral and fits) or BigDecimal
     * - Boolean -> Boolean
     * - Null -> null
     * - Map -> Map<String,Object> (recursively)
     * - List -> List<Object> (recursively)
     * - StringSet -> List<String>
     * - NumberSet -> List<Number>
     */
    @SuppressWarnings("unchecked")
    private static Object avToPlain(AttributeValue av) {
        if (av == null) return null;

        if (av.s() != null) return av.s();

        if (av.n() != null) {
            String n = av.n();
            try {
                // try integer first
                BigDecimal bd = new BigDecimal(n);
                if (bd.scale() == 0) {
                    // within integer range?
                    try {
                        return bd.intValueExact();
                    } catch (ArithmeticException ignored) {
                        // too big for int, keep BigDecimal
                        return bd;
                    }
                } else {
                    return bd;
                }
            } catch (NumberFormatException e) {
                return n;
            }
        }

        if (av.bool() != null) return av.bool();

        if (av.nul() != null && av.nul()) return null;

        if (av.m() != null && !av.m().isEmpty()) {
            return itemToPlain(av.m());
        }

        if (av.l() != null && !av.l().isEmpty()) {
            List<Object> list = new ArrayList<>();
            for (AttributeValue a : av.l()) {
                list.add(avToPlain(a));
            }
            return list;
        }

        if (av.ss() != null && !av.ss().isEmpty()) {
            return new ArrayList<>(av.ss());
        }

        if (av.ns() != null && !av.ns().isEmpty()) {
            List<Object> nums = new ArrayList<>();
            for (String s : av.ns()) {
                try {
                    BigDecimal bd = new BigDecimal(s);
                    if (bd.scale() == 0) {
                        try { nums.add(bd.intValueExact()); }
                        catch (ArithmeticException ex) { nums.add(bd); }
                    } else {
                        nums.add(bd);
                    }
                } catch (NumberFormatException ex) {
                    nums.add(s);
                }
            }
            return nums;
        }

        // fallback to toString for binaries / unknown cases
        return av.toString();
    }

    private static Map<String, Object> itemToPlain(Map<String, AttributeValue> item) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (item == null) return out;
        item.forEach((k, v) -> out.put(k, avToPlain(v)));
        return out;
    }

    /**
     * Create a User from a DynamoDB item map.
     * Returns null if item is null or empty.
     */
    public static User fromItem(Map<String, AttributeValue> item) {
        if (item == null || item.isEmpty()) return null;

        Map<String, Object> plain = itemToPlain(item);

        // Helpful debug during development:
        // System.out.println("Plain map: " + plain);

        return MAPPER.convertValue(plain, User.class);
    }
}
