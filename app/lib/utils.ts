import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const NAV_RECIPES_TRANSITION_NAME = "nav-recipes-link"
export const GENERATE_CTA_TRANSITION_NAME = "generate-recipe-cta"

export function getRecipeTitleTransitionName(recipeId: string): string {
  return `recipe-title-${recipeId.replace(/[^a-zA-Z0-9_-]/g, "_")}`
}
