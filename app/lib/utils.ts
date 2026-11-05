import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRecipeTitleTransitionName(recipeId: string): string {
  return `recipe-title-${recipeId.replace(/[^a-zA-Z0-9_-]/g, "_")}`
}
