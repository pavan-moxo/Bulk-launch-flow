// netlify/functions/proxy-webhook.js
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { url, payload } = JSON.parse(event.body);

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "URL is required" })
      };
    }

    console.log("🔵 Proxy: Forwarding to:", url);

    // Make the actual webhook call from the server
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Try to get response body
    let responseData;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Return the full response to your frontend
    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        ok: response.ok,
      }),
    };

  } catch (error) {
    console.error("🔴 Proxy Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        status: "network_failed"
      }),
    };
  }
};