package com.yadab.sr.sender.channels;

import com.amazonaws.services.lambda.runtime.Context;
import com.yadab.sr.sender.model.UserProfile;

import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.SesV2Exception;

/**
 * Email delivery channel via Amazon SES v2.
 *
 * Features:
 * - HTML + plain text versions
 * - SES Sandbox support (verify recipients)
 * - Cost: $0.10 per 1,000 emails
 */
public class EmailChannel implements NotificationChannel {
    private final SesV2Client ses;
    private final String defaultFromAddress;

    public EmailChannel(SesV2Client ses, String defaultFromAddress) {
        this.ses = ses;
        this.defaultFromAddress = defaultFromAddress;
    }

    @Override
    public String getChannelType() {
        return "EMAIL";
    }

    @Override
    public boolean canSend(UserProfile user) {
        return user.getEmail() != null && !user.getEmail().isEmpty();
    }

    @Override
    public String getRequiredField() {
        return "email";
    }

    @Override
    public void send(String recipient, String subject, String body, Context context) throws Exception {
        context.getLogger().log("Sending email to: " + recipient + " via SES");

        try {
            // Strip HTML for text version
            String textBody = body.replaceAll("<[^>]+>", "").trim();

            Content subjectContent = Content.builder()
                    .data(subject)
                    .charset("UTF-8")
                    .build();

            Content htmlContent = Content.builder()
                    .data(body)
                    .charset("UTF-8")
                    .build();

            Content textContent = Content.builder()
                    .data(textBody)
                    .charset("UTF-8")
                    .build();

            Body messageBody = Body.builder()
                    .html(htmlContent)
                    .text(textContent)
                    .build();

            Message message = Message.builder()
                    .subject(subjectContent)
                    .body(messageBody)
                    .build();

            Destination destination = Destination.builder()
                    .toAddresses(recipient)
                    .build();

            EmailContent emailContent = EmailContent.builder()
                    .simple(message)
                    .build();

            SendEmailRequest emailRequest = SendEmailRequest.builder()
                    .fromEmailAddress(defaultFromAddress)
                    .destination(destination)
                    .content(emailContent)
                    .build();

            ses.sendEmail(emailRequest);
            context.getLogger().log("Email sent successfully to: " + recipient);

        } catch (SesV2Exception e) {
            context.getLogger().log("SES error: " + e.awsErrorDetails().errorMessage());
            throw new Exception("Failed to send email via SES: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    @Override
    public double getCostPerMessage() {
        return 0.0001; // $0.10 per 1,000 emails = $0.0001 per email
    }
}
