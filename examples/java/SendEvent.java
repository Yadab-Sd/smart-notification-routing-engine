import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;

public class SendEvent {
    public static void main(String[] args) throws Exception {
        String apiUrl = System.getenv("SNRE_API_URL");
        String token = System.getenv("SNRE_TOKEN");

        if (apiUrl == null || apiUrl.isBlank() || token == null || token.isBlank()) {
            throw new IllegalStateException("Set SNRE_API_URL and SNRE_TOKEN before running this example.");
        }

        String payload = """
            {
              "userId": "example_user_1",
              "email": "example.user@example.com",
              "firstName": "Example",
              "type": "ABANDONED_CART",
              "ts": "%s",
              "notification": {
                "deliveryMode": "OPTIMIZED",
                "channel": "EMAIL",
                "message": "You left something in your cart.",
                "sourceId": "campaign:example_abandoned_cart",
                "campaignId": "example_abandoned_cart",
                "messageCategory": "MARKETING",
                "priorityClass": "LOW",
                "businessValue": 6.0,
                "urgency": 0.3,
                "maxDelayHours": 24,
                "metadata": {
                  "subject": "Complete your order"
                }
              }
            }
            """.formatted(Instant.now().toString());

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(apiUrl + "/v1/events"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.statusCode());
        System.out.println(response.body());
    }
}

