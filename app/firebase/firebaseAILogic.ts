import { getGenerativeModel, Schema } from "firebase/ai";
import { getFirebaseAI } from "./firebase";
import { getRecipeGenerationSettings } from "./remoteConfig";
import type { NewRecipeInput } from "./data";

const recipeSchema = Schema.object({
  properties: {
    title: Schema.string(),
    ingredients: Schema.array({ items: Schema.string() }),
    instructions: Schema.string({
      description:
        "Markdown-formatted recipe instructions. Avoid escaping whitespace characters.",
    }),
    tags: Schema.array({ items: Schema.string() }),
    prepTime: Schema.string(),
    cookTime: Schema.string(),
    servings: Schema.string(),
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
      maxOutputTokens: 2048,
    },
  });

  const cuisineClause = cuisineType ? ` in the ${cuisineType} cuisine` : "";
  const prompt = `Using the following list of ingredients, create a recipe${cuisineClause}: ${ingredients}.`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as Partial<NewRecipeInput>;

  return {
    title: parsed.title || "Chef's Special",
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    instructions: parsed.instructions || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    prepTime: parsed.prepTime || "15 mins",
    cookTime: parsed.cookTime || "20 mins",
    servings: parsed.servings || "4",
  };
}
