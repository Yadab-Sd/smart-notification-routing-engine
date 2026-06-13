package com.yadab.sr.sender.channels;

import com.amazonaws.services.lambda.runtime.Context;
import com.yadab.sr.sender.model.UserProfile;

import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import software.amazon.awssdk.services.sns.model.PublishResponse;
import software.amazon.awssdk.services.sns.model.SnsException;

/**
 * SMS delivery channel via Amazon SNS.
 *
 * Features:
 * - Plain text only (HTML stripped)
 * - 160-character limit (auto-truncate)
 * - E.164 phone format required (+1XXXXXXXXXX)
 * - Cost: $0.00645 per SMS (US)
 */
public class SmsChannel implements NotificationChannel {
    private final SnsClient sns;
    private static final int SMS_MAX_LENGTH = 160;

    public SmsChannel(SnsClient sns) {
        this.sns = sns;
    }

    @Override
    public String getChannelType() {
        return "SMS";
    }

    @Override
    public boolean canSend(UserProfile user) {
        String phone = user.getPhone();
        if (phone == null || phone.isEmpty()) {
            return false;
        }
        // Validate E.164 format: +[country code][number]
        return phone.matches("^\\+[1-9]\\d{1,14}$");
    }

    @Override
    public String getRequiredField() {
        return "phone";
    }

    @Override
    public void send(String recipient, String subject, String body, Context context) throws Exception {
        context.getLogger().log("Sending SMS to: " + recipient + " via SNS");

        try {
            // Strip HTML tags for SMS (plain text only)
            String textBody = body.replaceAll("<[^>]+>", "").trim();

            // Truncate if exceeds SMS limit
            String smsMessage = textBody.length() > SMS_MAX_LENGTH
                    ? textBody.substring(0, SMS_MAX_LENGTH - 3) + "..."
                    : textBody;

            PublishRequest request = PublishRequest.builder()
                    .message(smsMessage)
                    .phoneNumber(recipient)
                    .build();

            PublishResponse result = sns.publish(request);
            context.getLogger().log("SMS sent successfully. MessageId: " + result.messageId());

        } catch (SnsException e) {
            context.getLogger().log("SNS error: " + e.awsErrorDetails().errorMessage());
            throw new Exception("Failed to send SMS via SNS: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    @Override
    public double getCostPerMessage() {
        return 0.00645; // US domestic SMS cost
    }
}
