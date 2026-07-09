import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";
import { resend } from "@/shared/email";
import { logger } from "@/shared/logger";

// Loosely echoes the Field Ledger palette (docs/adr/007-visual-identity.md)
// without the fuller stamp/ledger-numbering treatment — same lighter-weight
// tier used by order-confirmation.email.tsx.
const COLORS = {
  background: "#ede6d6",
  foreground: "#26231f",
  secondary: "#7a4b2e",
};

export function WelcomeEmail({ customerName }: { customerName: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Welcome, ${customerName}`}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.background,
          color: COLORS.foreground,
          fontFamily: "'Public Sans', Arial, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            padding: "32px 24px",
          }}
        >
          <Heading style={{ fontSize: "20px", margin: "0 0 8px" }}>
            Welcome
          </Heading>
          <Text style={{ margin: "0 0 16px", color: COLORS.secondary }}>
            Hi {customerName}, thanks for joining Marketplace.
          </Text>
          <Text style={{ margin: "0 0 16px", color: COLORS.secondary }}>
            Your account is all set up. Browse our full range of goods whenever
            you're ready, and check out in just a few clicks — we'll keep your
            details on hand to make it quick next time.
          </Text>
          <Text style={{ margin: "0", color: COLORS.secondary }}>
            We're glad to have you with us.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const EMAIL_FROM = process.env.EMAIL_FROM!;

export async function sendWelcomeEmail(
  toEmail: string,
  toName: string,
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: "Welcome to Marketplace",
      react: <WelcomeEmail customerName={toName} />,
    });

    if (error) {
      logger.warn({ error }, "Failed to send welcome email");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to send welcome email");
  }
}
