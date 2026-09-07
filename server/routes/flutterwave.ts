import type { RequestHandler } from "express";

const flutterwaveBaseUrl = "https://api.flutterwave.com/v3";

const getConfiguration = () => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const redirectUrl = process.env.FLUTTERWAVE_REDIRECT_URL;

  if (!secretKey || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !redirectUrl) {
    throw new Error("Flutterwave payment configuration is incomplete");
  }

  return { secretKey, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, redirectUrl };
};

const getAuthenticatedOrder = async (orderId: string, authorization?: string) => {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing authenticated session");
  }

  const { supabaseUrl, supabaseAnonKey } = getConfiguration();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/menu_orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
    {
      headers: {
        apikey: supabaseAnonKey,
        authorization,
      },
    },
  );

  if (!response.ok) throw new Error("Unable to retrieve this order");

  const [order] = await response.json();
  if (!order) throw new Error("Order not found");
  return order;
};

const updateOrder = async (orderId: string, authorization: string, values: Record<string, unknown>) => {
  const { supabaseUrl, supabaseAnonKey } = getConfiguration();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/menu_orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        authorization,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(values),
    },
  );

  if (!response.ok) throw new Error("Unable to update this order");
};

export const initiateFlutterwavePayment: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return res.status(400).json({ error: "Order ID is required" });

    const authorization = req.headers.authorization;
    const order = await getAuthenticatedOrder(orderId, authorization);
    const { secretKey, redirectUrl } = getConfiguration();
    const transactionReference = `sheraton-${order.order_number}-${Date.now()}`;
    const paymentOptions = order.payment_method === "mobile-money" ? "mobilemoney" : "card";

    const flutterwaveResponse = await fetch(`${flutterwaveBaseUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: transactionReference,
        amount: String(order.total_amount),
        currency: "UGX",
        redirect_url: redirectUrl,
        payment_options: paymentOptions,
        customer: {
          email: order.email,
          name: `${order.first_name} ${order.last_name}`.trim(),
          phonenumber: order.phone,
        },
        meta: { order_id: order.id },
        customizations: { title: "Sheraton Special" },
      }),
    });

    const payload = await flutterwaveResponse.json();
    if (!flutterwaveResponse.ok || payload.status !== "success" || !payload.data?.link) {
      console.error("Flutterwave initiation failed", payload);
      return res.status(502).json({ error: "Unable to start payment" });
    }

    await updateOrder(order.id, authorization!, {
      payment_reference: transactionReference,
      payment_status: "pending",
    });

    return res.json({ paymentLink: payload.data.link });
  } catch (error) {
    console.error("Flutterwave payment initiation error", error);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to start payment" });
  }
};

export const verifyFlutterwavePayment: RequestHandler = async (req, res) => {
  try {
    const transactionId = String(req.query.transaction_id || "");
    const orderId = String(req.query.order_id || "");
    if (!transactionId || !orderId) return res.status(400).send("Invalid payment callback");

    const { secretKey } = getConfiguration();
    const verificationResponse = await fetch(`${flutterwaveBaseUrl}/transactions/${encodeURIComponent(transactionId)}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verification = await verificationResponse.json();
    const transaction = verification.data;

    if (!verificationResponse.ok || verification.status !== "success" || transaction?.meta?.order_id !== orderId) {
      return res.status(400).send("Payment could not be verified");
    }

    const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration();
    const paymentStatus = transaction.status === "successful" ? "paid" : "failed";
    await fetch(`${supabaseUrl}/rest/v1/menu_orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: transaction.status === "successful" ? "confirmed" : "pending",
        payment_status: paymentStatus,
        flutterwave_transaction_id: String(transaction.id),
      }),
    });

    return res.redirect(`/menu?order=${encodeURIComponent(orderId)}&payment=${paymentStatus}`);
  } catch (error) {
    console.error("Flutterwave payment verification error", error);
    return res.status(500).send("Unable to verify payment");
  }
};
