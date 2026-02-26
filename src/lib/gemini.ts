/**
 * Gemini AI – Proof of Delivery verification
 */

export interface GeminiPODResult {
  match: boolean;
  reason: string;
}

export async function verifyProofOfDelivery(
  imageBase64: string,       // base64-encoded image (no data: prefix)
  mimeType: string,          // e.g. 'image/jpeg'
  expectedInvoiceNo: string  // the SI number to look for
): Promise<GeminiPODResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `Analyze this Proof of Delivery photo.
1. Does the photo clearly contain the Sales Invoice number ${expectedInvoiceNo}?
2. Is there a human visible in the frame accepting the package?

Return ONLY a valid JSON object with no markdown or extra text:
{"match": true or false, "reason": "short explanation"}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip potential markdown fences
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as GeminiPODResult;
    return {
      match: Boolean(parsed.match),
      reason: parsed.reason ?? 'No reason provided',
    };
  } catch {
    // If AI returned garbled JSON, treat as no-match
    return { match: false, reason: `AI returned unparseable response: ${text}` };
  }
}
