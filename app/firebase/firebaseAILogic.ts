import {
  FinishReason,
  getGenerativeModel,
  Schema,
  ThinkingLevel,
} from "firebase/ai";
import { getFirebaseAI } from "./firebase";
import { getRecipeGenerationSettings } from "./remoteConfig";
import type { InstructionStep, NewRecipeInput } from "./data";

const recipeSchema = Schema.object({
  properties: {
    title: Schema.string({
      description: "Appetizing recipe title",
    }),
    ingredients: Schema.array({
      description:
        "Ingredients with quantities, e.g. '2 ripe bananas, sliced'",
      items: Schema.string(),
    }),
    instructions: Schema.array({
      description: "Ordered cooking steps from prep to serving",
      items: Schema.object({
        properties: {
          title: Schema.string({
            description:
              "Short action heading without step numbers, e.g. 'Make the Spiced Syrup'",
          }),
          content: Schema.string({
            description: "Clear paragraph explaining how to perform this step",
          }),
        },
      }),
    }),
    tags: Schema.array({
      description: "2 to 5 concise category or dietary tags",
      items: Schema.string(),
    }),
    prepTime: Schema.string({
      description: "Short duration, e.g. '10 mins'",
    }),
    cookTime: Schema.string({
      description: "Short duration, e.g. '25 mins'",
    }),
    servings: Schema.string({
      description: "Number of servings only, e.g. '4'",
    }),
  },
});

/**
 * Calls Gemini directly from the client via Firebase AI Logic to generate a
 * structured JSON recipe matching `recipeSchema`.
 */
export async function generateStructuredJsonRecipe(
  ingredients: string,
  cuisineType: string
): Promise<NewRecipeInput> {
  const ai = getFirebaseAI();
  const { model: modelName, systemInstruction } =
    await getRecipeGenerationSettings();

  const model = getGenerativeModel(ai, {
    model: modelName,
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const cuisineClause = cuisineType ? ` in the ${cuisineType} cuisine` : "";
  const prompt = `Using the following list of ingredients, create a recipe${cuisineClause}: ${ingredients}.`;

  const result = await model.generateContent(prompt);
  const finishReason = result.response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== FinishReason.STOP) {
    throw new Error(`Recipe generation incomplete (${finishReason}).`);
  }
  const parsed = JSON.parse(result.response.text()) as Partial<NewRecipeInput>;

  const instructions: InstructionStep[] = Array.isArray(parsed.instructions)
    ? parsed.instructions
        .filter(
          (step): step is InstructionStep =>
            Boolean(step) &&
            typeof step.title === "string" &&
            typeof step.content === "string"
        )
        .map((step) => ({
          title: step.title.trim(),
          content: step.content.trim(),
        }))
    : [];

  return {
    title: parsed.title || "Chef's Special",
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    instructions,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    prepTime: parsed.prepTime || "15 mins",
    cookTime: parsed.cookTime || "20 mins",
    servings: parsed.servings || "4",
  };
}
