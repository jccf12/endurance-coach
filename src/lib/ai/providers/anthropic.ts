import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// Use Haiku for chat (cheap), Sonnet for plan generation (quality)
const CHAT_MODEL = "claude-haiku-4-5-20251001";
const PLAN_MODEL = "claude-sonnet-4-6";

export async function anthropicChat(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  options: { stream?: boolean; planGeneration?: boolean; tools?: Anthropic.Messages.Tool[] } = {}
) {
  const model = options.planGeneration ? PLAN_MODEL : CHAT_MODEL;
  const baseParams = {
    model,
    max_tokens: options.planGeneration ? 8192 : 2048,
    system: systemPrompt,
    messages,
    ...(options.tools && options.tools.length > 0
      ? { tools: options.tools, tool_choice: { type: "auto" as const } }
      : {}),
  };

  if (options.stream) {
    return getClient().messages.stream(baseParams);
  }

  return getClient().messages.create(baseParams);
}

export async function anthropicGeneratePlan(
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const stream = getClient().messages.stream({
    model: PLAN_MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  if (onChunk) {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onChunk(event.delta.text);
      }
    }
  }

  const message = await stream.finalMessage();
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Anthropic");
  }
  return textBlock.text;
}
