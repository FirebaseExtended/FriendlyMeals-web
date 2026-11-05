import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  type RemoteConfig,
} from "firebase/remote-config";
import { firebaseApp } from "./firebase";

export const DEFAULT_RECIPE_MODEL = "gemini-3.8-flash";

export const DEFAULT_RECIPE_SYSTEM_PROMPT =
  "You are a friendly chef creating approachable home-cooked recipes. Write clear step-by-step instructions with concise step titles, practical prep and cook times, and 2 to 5 concise tags.";

export interface RecipeGenerationSettings {
  model: string;
  systemInstruction: string;
}

let remoteConfigInstance: RemoteConfig | null = null;

/**
 * Reads `recipe_model` and `recipe_system_prompt` from Firebase Remote Config in
 * the browser so models and prompts can be tuned or rolled back without a redeploy.
 * Falls back cleanly to defaults offline, during SSR, or before Remote Config is
 * published in the Firebase Console.
 */
export async function getRecipeGenerationSettings(): Promise<RecipeGenerationSettings> {
  if (typeof window === "undefined") {
    return {
      model: DEFAULT_RECIPE_MODEL,
      systemInstruction: DEFAULT_RECIPE_SYSTEM_PROMPT,
    };
  }

  try {
    if (!remoteConfigInstance) {
      remoteConfigInstance = getRemoteConfig(firebaseApp);
      remoteConfigInstance.settings.minimumFetchIntervalMillis = import.meta.env.DEV
        ? 10_000
        : 3_600_000;
      remoteConfigInstance.defaultConfig = {
        recipe_model: DEFAULT_RECIPE_MODEL,
        recipe_system_prompt: DEFAULT_RECIPE_SYSTEM_PROMPT,
      };
    }

    await fetchAndActivate(remoteConfigInstance);
    const model = getValue(remoteConfigInstance, "recipe_model")
      .asString()
      .trim();
    const prompt = getValue(remoteConfigInstance, "recipe_system_prompt")
      .asString()
      .trim();

    return {
      model: model || DEFAULT_RECIPE_MODEL,
      systemInstruction: prompt || DEFAULT_RECIPE_SYSTEM_PROMPT,
    };
  } catch {
    return {
      model: DEFAULT_RECIPE_MODEL,
      systemInstruction: DEFAULT_RECIPE_SYSTEM_PROMPT,
    };
  }
}

export async function getRecipeSystemPrompt(): Promise<string> {
  const { systemInstruction } = await getRecipeGenerationSettings();
  return systemInstruction;
}
