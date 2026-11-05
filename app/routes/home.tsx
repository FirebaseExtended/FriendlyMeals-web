import { href, Link } from "react-router";
import { BookOpen, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWasServerRendered } from "@/lib/ssr";
import { cn } from "@/lib/utils";

export function meta() {
  return [
    { title: "Friendly Meals - AI-Powered Recipe Generator" },
    {
      name: "description",
      content:
        "Generate structured recipes with Firebase AI Logic and browse community recipes rendered with React Router SSR.",
    },
  ];
}

export default function HomePage() {
  const isSsr = useWasServerRendered();

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50 dark:from-emerald-950 dark:via-gray-900 dark:to-orange-950",
        isSsr && "ssr"
      )}
    >
      <div className="flex flex-col items-center justify-center px-6 pt-16 pb-12">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
            <Flame className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-center bg-gradient-to-r from-emerald-600 via-emerald-500 to-orange-500 bg-clip-text text-transparent mb-4">
          Friendly Meals
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground text-center max-w-lg mb-8">
          AI-powered recipe generation and community cookbook
        </p>

        <Button
          asChild
          size="lg"
          className="text-lg px-8 py-6 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/40 mb-12"
        >
          <Link to={href("/generate")} className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            Generate a Recipe
          </Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          <Link
            to={href("/generate")}
            className="group flex flex-col items-center p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-border/50 hover:border-emerald-300 hover:bg-white dark:hover:bg-gray-800 transition-all hover:shadow-lg hover:scale-[1.02]"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
              <Sparkles className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-semibold text-foreground">
              AI Recipe Studio
            </span>
            <span className="text-sm text-muted-foreground text-center mt-1">
              Turn pantry ingredients into structured recipes with Gemini
            </span>
          </Link>

          <Link
            to={href("/recipes")}
            className="group flex flex-col items-center p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-border/50 hover:border-emerald-300 hover:bg-white dark:hover:bg-gray-800 transition-all hover:shadow-lg hover:scale-[1.02]"
          >
            <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
              <BookOpen className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-foreground">All Recipes</span>
            <span className="text-sm text-muted-foreground text-center mt-1">
              Browse SSR-rendered recipes published by other chefs
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
