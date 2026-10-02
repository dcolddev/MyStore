export interface OrderEmailItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderEmailPayload {
  orderId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  totalAmount: number;
  paymentMethod: string;
  items: OrderEmailItem[];
}

export const sendOrderConfirmationEmail = async (
  payload: OrderEmailPayload
): Promise<{ success: boolean; simulated: boolean; message: string }> => {
  const apiKey = import.meta.env.VITE_MAILGUN_API_KEY;
  const domain = import.meta.env.VITE_MAILGUN_DOMAIN;
  const sender = import.meta.env.VITE_MAILGUN_SENDER_EMAIL || `Pocket Shop <orders@${domain || 'mg.pocketshop.com'}>`;

  const itemsHtml = payload.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₦${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₦${item.totalPrice.toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #4f46e5; padding: 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Order Confirmation</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Thank you for your purchase with Pocket Shop!</p>
      </div>
      <div style="padding: 24px;">
        <p>Hello <strong>${payload.customerName}</strong>,</p>
        <p>Your order <strong>#${payload.orderId.slice(0, 8)}</strong> has been confirmed.</p>
        
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Shipping Address:</strong> ${payload.shippingAddress}</p>
          <p style="margin: 0;"><strong>Payment Method:</strong> ${payload.paymentMethod.toUpperCase()}</p>
        </div>

        <h3 style="border-bottom: 2px solid #4f46e5; padding-bottom: 8px;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left;">
              <th style="padding: 10px;">Item</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
              <th style="padding: 10px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; font-size: 18px; font-weight: bold; padding: 12px; background-color: #f3f4f6; border-radius: 6px;">
          Total Paid: ₦${payload.totalAmount.toFixed(2)}
        </div>
      </div>
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
        Pocket Shop Manager • Automated Mailgun Notification Service
      </div>
    </div>
  `;

  // Check if live Mailgun credentials are supplied
  if (apiKey && domain) {
    try {
      const formData = new FormData();
      formData.append('from', sender);
      formData.append('to', payload.customerEmail);
      formData.append('subject', `Order Confirmation #${payload.orderId.slice(0, 8)} - Pocket Shop`);
      formData.append('html', emailHtml);

      const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`api:${apiKey}`),
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Mailgun API Error:', errText);
        return {
          success: false,
          simulated: false,
          message: `Mailgun API error: ${response.statusText}`,
        };
      }

      return {
        success: true,
        simulated: false,
        message: `Order confirmation sent to ${payload.customerEmail} via Mailgun!`,
      };
    } catch (error: any) {
      console.error('Mailgun Dispatch Failed:', error);
      return {
        success: false,
        simulated: false,
        message: error.message || 'Mailgun network dispatch failed',
      };
    }
  }

  // Fallback Simulation Mode
  console.log(
    '%c[Mailgun Service] Sending Confirmation Email:',
    'color: #4f46e5; font-weight: bold; font-size: 14px;'
  );
  console.log(`To: ${payload.customerEmail}`);
  console.log(`Subject: Order Confirmation #${payload.orderId.slice(0, 8)}`);
  console.log(`Payload:`, payload);

  return {
    success: true,
    simulated: true,
    message: `Confirmation email sent to ${payload.customerEmail} (Mailgun simulated). Add VITE_MAILGUN_API_KEY & VITE_MAILGUN_DOMAIN to enable live dispatch.`,
  };
};
