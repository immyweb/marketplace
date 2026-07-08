import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";
import { resend } from "@/shared/email";
import { logger } from "@/shared/logger";
import type { OrderDTO } from "./orders.service";

// Loosely echoes the Field Ledger palette (docs/adr/007-visual-identity.md)
// without the fuller stamp/ledger-numbering treatment — a deliberate,
// lighter-weight tier for this email (see design doc's Consequences).
const COLORS = {
  background: "#ede6d6",
  foreground: "#26231f",
  secondary: "#7a4b2e",
};

const MONO_FONT = "'IBM Plex Mono', 'Courier New', monospace";

export function OrderConfirmationEmail({
  order,
  customerName,
}: {
  order: OrderDTO;
  customerName: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Order #${order.id} confirmed — thank you for your order`}</Preview>
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
            Order Confirmed
          </Heading>
          <Text style={{ margin: "0 0 16px" }}>
            Hi {customerName}, thanks for your order.
          </Text>
          <Text
            style={{
              fontFamily: MONO_FONT,
              color: COLORS.secondary,
              margin: "0 0 16px",
            }}
          >
            Order #{order.id}
          </Text>
          <Hr />
          {order.items.map((item, index) => (
            <Row key={index}>
              <Column>
                <Text style={{ margin: "8px 0 0" }}>{item.product.name}</Text>
                <Text
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: "13px",
                    margin: "0 0 8px",
                  }}
                >
                  Qty {item.quantity} × {item.currency} {item.price.toFixed(2)}
                </Text>
              </Column>
            </Row>
          ))}
          <Hr />
          <Text
            style={{
              fontFamily: MONO_FONT,
              fontWeight: "bold",
              margin: "16px 0",
            }}
          >
            Total: {order.currency} {order.total_price.toFixed(2)}
          </Text>
          <Hr />
          <Section>
            <Text style={{ fontWeight: "bold", margin: "16px 0 4px" }}>
              Shipping to
            </Text>
            <Text style={{ margin: "0 0 16px" }}>
              {order.address_details.name}
              <br />
              {order.address_details.street}
              <br />
              {order.address_details.city} {order.address_details.postcode}
            </Text>
          </Section>
          <Text
            style={{
              fontFamily: MONO_FONT,
              fontSize: "12px",
              color: COLORS.secondary,
            }}
          >
            Card ending in {order.payment_details.card_last_four_digits}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const EMAIL_FROM = process.env.EMAIL_FROM!;

export async function sendOrderConfirmationEmail(
  order: OrderDTO,
  toEmail: string,
  toName: string,
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `Order Confirmation — #${order.id}`,
      react: <OrderConfirmationEmail order={order} customerName={toName} />,
    });

    if (error) {
      logger.warn(
        { orderId: order.id, error },
        "Failed to send order confirmation email",
      );
    }
  } catch (err) {
    logger.warn(
      { orderId: order.id, err },
      "Failed to send order confirmation email",
    );
  }
}
