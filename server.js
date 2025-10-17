import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// --------------------
// PayPro Configuration
// --------------------
const PAYPRO_AUTH_URL = "https://api.paypro.com.pk/v2/ppro/auth";
const PAYPRO_CREATE_ORDER_URL = "https://api.paypro.com.pk/v2/ppro/co";

const clientid = "9ki8hvTljifIX1B";
const clientsecret = "z8zP4PceM03Lff2";
const MerchantId = "Tahira_Begum";

let authToken = null;

// ============================
// 1️⃣ Get Auth Token from PayPro
// ============================
app.get("/api/auth", async (req, res) => {
  console.log("🔹 /api/auth called");
  try {
    const response = await fetch(PAYPRO_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientid, clientsecret }),
    });

    // Try to get token from headers first
    const headerToken = response.headers.get("token");
    const data = await response.json();

    if (headerToken) {
      authToken = headerToken;
      console.log("✅ Token retrieved from headers:", authToken);
    } else if (data.token) {
      authToken = data.token;
      console.log("✅ Token retrieved from JSON:", authToken);
    } else {
      console.error("❌ No token found in response:", data);
      return res.status(400).json({ error: "Token not found", details: data });
    }

    res.json({
      message: "Token received successfully",
      token: authToken,
    });
  } catch (err) {
    console.error("🔥 Auth Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================
// 2️⃣ Create PayPro Order
// ============================
app.post("/api/order", async (req, res) => {
  const { amount } = req.body;
  console.log("🔹 /api/order called");

  try {
    if (!authToken) {
      console.warn("⚠️ Missing auth token, call /api/auth first.");
      return res.status(401).json({ error: "Not authenticated yet" });
    }

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const orderData = [
      { MerchantId },
      {
        OrderNumber: "Order-" + Date.now(),
        OrderAmount: amount.toString(),
        OrderDueDate: "31/12/2025",
        OrderType: "Service",
        IssueDate: "17/10/2025",
        OrderExpireAfterSeconds: "0",
        CustomerName: "Customer",
        CustomerMobile: "",
        CustomerEmail: "",
        CustomerAddress: "",
      },
    ];

    console.log("📦 Sending order data:", orderData);

    const response = await fetch(PAYPRO_CREATE_ORDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: authToken,
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    // ✅ Extract only meaningful info from response
    const orderInfo = data?.[1] || {};
    const simplified = {
      status: data?.[0]?.Status || "Unknown",
      payProId: orderInfo.PayProId,
      orderNumber: orderInfo.OrderNumber,
      orderAmount: orderInfo.OrderAmount,
      click2Pay: orderInfo.Click2Pay,
      iframeClick2Pay: orderInfo.IframeClick2Pay,
      billUrl: orderInfo.BillUrl,
      shortBillUrl: orderInfo.short_BillUrl,
      createdOn: orderInfo.Created_on,
    };

    console.log("✅ Simplified Order Response:", simplified);
    res.json(simplified);
  } catch (err) {
    console.error("🔥 Order Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================
// Server Start
// ============================
app.listen(3000, () =>
  console.log("🚀 Server running at: http://localhost:3000")
);
