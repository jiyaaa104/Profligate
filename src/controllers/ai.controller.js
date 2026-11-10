import { GoogleGenAI, Type } from "@google/genai";

import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Configuration
const MODEL = "gemini-3.8-flash";
const INSIGHT_COUNT = 3;
const MAX_WORDS_PER_INSIGHT = 15;
const LOOKBACK_DAYS = 30;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 30000;

// Normalize individual insights
const normalizeInsight = (insight) => {
  if (typeof insight !== "string") return null;

  const cleaned = insight
    .replace(/^[\s•\-*]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  return cleaned.split(/\s+/).slice(0, MAX_WORDS_PER_INSIGHT).join(" ");
};

// Retry temporary Gemini failures
const generateWithRetry = async (prompt) => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await ai.models.generateContent({
        model: MODEL,
        contents: prompt,

        config: {
          responseMimeType: "application/json",

          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
              },
            },
            required: ["insights"],
          },

          // 30-second request timeout
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT),
        },
      });
    } catch (error) {
      const status = error.status || error.response?.status;

      const isRetryable = [429, 500, 502, 503, 504].includes(status);

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error;
      }

      // Exponential backoff: 1 second, then 2 seconds
      const delay = 1000 * Math.pow(2, attempt);

      console.warn(
        `Gemini request failed (${status}). Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Gemini request failed after retries.");
};

const getAIInsights = asyncHandler(async (req, res) => {
  // 1. Verify user
  const user = await User.findById(req.user._id)
    .select("preferences.aiInsightsEnabled")
    .lean();

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (!user.preferences?.aiInsightsEnabled) {
    throw new ApiError(403, "AI insights are disabled in your profile.");
  }

  // 2. Calculate date range
  const now = new Date();

  const thirtyDaysAgo = new Date(
    now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  // 3. Aggregate expenses using MongoDB
  const categoryTotals = await Transaction.aggregate([
    {
      $match: {
        userId: user._id,
        type: "expense",
        transactionDate: {
          $gte: thirtyDaysAgo,
          $lte: now,
        },
      },
    },
    {
      $group: {
        _id: "$category",
        totalPaise: {
          $sum: "$amountPaise",
        },
      },
    },
    {
      $sort: {
        totalPaise: -1,
      },
    },
  ]);

  // 4. Handle empty expense history
  if (categoryTotals.length === 0) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          insights: ["Add some expenses to get personalized AI insights!"],
        },
        "No expense data available.",
      ),
    );
  }

  // 5. Prepare spending data
  const totalSpentPaise = categoryTotals.reduce(
    (total, category) => total + category.totalPaise,
    0,
  );

  const spendingData = {
    totalSpent: Number((totalSpentPaise / 100).toFixed(2)),
    currency: "INR",
    period: `${LOOKBACK_DAYS} days`,

    categories: categoryTotals.map((category) => ({
      category: category._id,
      amount: Number((category.totalPaise / 100).toFixed(2)),
    })),
  };

  // 6. Construct Gemini prompt
  const prompt = `
You are Profligate, a friendly and non-judgmental AI personal finance assistant for college students.

Analyze the following spending data:

${JSON.stringify(spendingData)}

Generate exactly ${INSIGHT_COUNT} short, actionable and encouraging suggestions to help the user manage spending better next month.

Rules:
- Base every suggestion on the provided financial data.
- Prioritize categories with higher spending when relevant.
- Never shame or criticize the user's spending habits.
- Do not invent financial information.
- Each suggestion must contain at most ${MAX_WORDS_PER_INSIGHT} words.
- Avoid repeating recommendations.
- Return exactly ${INSIGHT_COUNT} suggestions.

Return the response in the specified JSON structure.
`;

  try {
    // 7. Generate insights with retry handling
    const response = await generateWithRetry(prompt);

    // 8. Validate Gemini response
    const responseText = response.text;

    if (!responseText) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsedResponse = JSON.parse(responseText);

    if (!Array.isArray(parsedResponse.insights)) {
      throw new Error("Invalid Gemini response structure.");
    }

    // 9. Normalize and validate insights
    const insights = parsedResponse.insights
      .map(normalizeInsight)
      .filter(Boolean)
      .slice(0, INSIGHT_COUNT);

    if (insights.length !== INSIGHT_COUNT) {
      throw new Error("Gemini did not return exactly three valid insights.");
    }

    // 10. Return response
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          insights,
          generatedAt: new Date(),
          period: LOOKBACK_DAYS,
        },
        "AI insights generated successfully.",
      ),
    );
  } catch (error) {
    console.error("AI Insights Generation Error:", {
      status: error.status,
      message: error.message,
    });

    throw new ApiError(
      502,
      "Unable to generate AI insights at this time. Please try again later.",
    );
  }
});

export { getAIInsights };
