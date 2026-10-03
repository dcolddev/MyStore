// Flutterwave v3 JS SDK Integration Helper

export interface FlutterwavePaymentConfig {
  email: string;
  amount: number; // In Naira (or currency unit)
  currency?: string;
  tx_ref?: string;
  customerName?: string;
  phone?: string;
  title?: string;
  description?: string;
  logo?: string;
  meta?: Record<string, any>;
  onSuccess: (response: any) => void;
  onClose?: () => void;
}

export const loadFlutterwaveScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).FlutterwaveCheckout) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load Flutterwave checkout script from CDN');
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

export const payWithFlutterwave = async (config: FlutterwavePaymentConfig): Promise<void> => {
  const loaded = await loadFlutterwaveScript();
  const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error('MISSING_KEY');
  }

  if (!loaded || !(window as any).FlutterwaveCheckout) {
    throw new Error('SCRIPT_BLOCKED');
  }

  const tx_ref = config.tx_ref || `flw_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  if (loaded && (window as any).FlutterwaveCheckout) {
    try {
      (window as any).FlutterwaveCheckout({
        public_key: publicKey || '',
        tx_ref,
        amount: config.amount,
        currency: config.currency || 'NGN',
        payment_options: 'card, ussd, banktransfer, account, mpesa',
        customer: {
          email: config.email,
          phone_number: config.phone || '',
          name: config.customerName || config.email,
        },
        customizations: {
          title: config.title || 'Pocket Shop Checkout',
          description: config.description || 'Payment for order items',
          logo: config.logo || 'https://assets.flutterwave.com/images/fw-logo.svg',
        },
        meta: config.meta || {},
        callback: function (response: any) {
          config.onSuccess(response);
        },
        onclose: function () {
          if (config.onClose) {
            config.onClose();
          }
        },
      });
      return;
    } catch (err) {
      console.error('Flutterwave Checkout modal error:', err);
      throw new Error('MODAL_ERROR');
    }
  }
};
