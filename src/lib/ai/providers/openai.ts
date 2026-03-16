import OpenAI from "openai";

// Lazy client — only instantiated when called, avoids build-time errors when key is absent
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// Use 4o-mini for chat (cheap), 4o for plan generation (quality)
const CHAT_MODEL = "gpt-4o-mini";
const PLAN_MODEL = "gpt-4o";

export async function openaiChat(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: { stream?: boolean; planGeneration?: boolean } = {}
) {
  const model = options.planGeneration ? PLAN_MODEL : CHAT_MODEL;
  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  if (options.stream) {
    return getClient().chat.completions.create({
      model,
      max_tokens: options.planGeneration ? 8192 : 2048,
      messages: allMessages,
      stream: true,
    });
  }

  return getClient().chat.completions.create({
    model,
    max_tokens: options.planGeneration ? 8192 : 2048,
    messages: allMessages,
    stream: false,
  });
}

export async function openaiGeneratePlan(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: PLAN_MODEL,
    max_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    stream: false,
  });

  return response.choices[0]?.message?.content ?? "";
}
