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
let tokenObtainedAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes heuristic

function isTokenExpired() {
  if (!authToken) return true;
  return (Date.now() - tokenObtainedAt) > TOKEN_TTL_MS;
}

// Helper to obtain token
async function obtainToken() {
  const resp = await fetch(PAYPRO_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientid, clientsecret })
  });

  const headersObj = Object.fromEntries(resp.headers.entries());

  const headerToken = resp.headers.get("token") || resp.headers.get("Token") || resp.headers.get("authorization");
  let bodyJson = {};
  try {
    bodyJson = await resp.json();
  } catch (e) {}

  const tokenFromJson = bodyJson?.token || bodyJson?.Token || bodyJson?.Data?.Token || bodyJson?.data?.Token;
  const final = headerToken || tokenFromJson;

  if (!final) {
    throw new Error("Auth token not found in headers or body. Headers: " + JSON.stringify(headersObj) + " Body: " + JSON.stringify(bodyJson));
  }

  authToken = final;
  tokenObtainedAt = Date.now();
  return authToken;
}

// Explicit auth endpoint
app.get("/api/auth", async (req, res) => {
  try {
    const token = await obtainToken();
    res.json({ message: "Token received", token });
  } catch (err) {
    console.error("/api/auth error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Create Order Endpoint
// --------------------
app.post("/api/order", async (req, res) => {
  try {
    const { amount, currency, customerName, customerMobile, customerEmail, customerAddress } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!currency || typeof currency !== "string") {
      return res.status(400).json({ error: "Currency is required (e.g., USD, PKR, EUR)" });
    }

    // Ensure token available and fresh
    if (!authToken || isTokenExpired()) {
      try {
        await obtainToken();
        console.log("✅ Auth token obtained (automatic refresh).");
      } catch (err) {
        console.error("Unable to obtain auth token:", err);
        return res.status(500).json({ error: "Unable to obtain auth token", details: err.message });
      }
    }

    // Build order data
    const orderData = currency=='PKR'?[ { MerchantId },
      {
        OrderNumber: "Order-" + Date.now(),
        OrderAmount: amount.toString(),
        OrderDueDate: "31/12/2025",
        OrderType: "Service",
        IssueDate: new Date().toISOString().split("T")[0],
        OrderExpireAfterSeconds: "0",
        CustomerName: customerName || "Customer",
        CustomerMobile: customerMobile || "",
        CustomerEmail: customerEmail || "",
        CustomerAddress: customerAddress || "",
      }]: [
      { MerchantId },
      {
        OrderNumber: "Order-" + Date.now(),
        CurrencyAmount: amount.toString(),
        OrderDueDate: "31/12/2025",
        OrderType: "Service",
        IssueDate: new Date().toISOString().split("T")[0],
        OrderExpireAfterSeconds: "0",
        CustomerName: customerName || "Customer",
        CustomerMobile: customerMobile || "",
        CustomerEmail: customerEmail || "",
        CustomerAddress: customerAddress || "",
        Currency: currency, // ✅ use selected currency
        IsConverted:  "true" // ✅ tells PayPro that currency is converted
      }
    ];

    console.log("📦 Creating order:", orderData);

    const createResp = await fetch(PAYPRO_CREATE_ORDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: authToken
      },
      body: JSON.stringify(orderData)
    });

    const createHeaders = Object.fromEntries(createResp.headers.entries());
    console.log("🔸 Create order headers:", createHeaders);

    const createJson = await createResp.json();
    console.log("✅ Raw create order response:", createJson);

    const statusObj = Array.isArray(createJson) ? createJson[0] : null;
    const detailObj = Array.isArray(createJson) ? createJson[1] : (createJson?.Data || createJson);

    const simplified = {
      status: statusObj?.Status || statusObj?.ResponseCode || (createJson?.ResponseCode ?? "Unknown"),
      payProId: detailObj?.PayProId ?? detailObj?.ConnectPayId ?? null,
      orderNumber: detailObj?.OrderNumber ?? detailObj?.OrderNo ?? null,
      orderAmount: detailObj?.OrderAmount ?? null,
      click2Pay: detailObj?.Click2Pay ?? null,
      iframeClick2Pay: detailObj?.Click2Pay ?? detailObj?.Click2Pay ?? null,
      billUrl: detailObj?.BillUrl ?? null,
      shortBillUrl: detailObj?.short_BillUrl ?? detailObj?.shortBillUrl ?? null,
      createdOn: detailObj?.Created_on ?? detailObj?.CreatedOn ?? null,
      raw: createJson
    };

    return res.json(simplified);
  } catch (err) {
    console.error("/api/order error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
