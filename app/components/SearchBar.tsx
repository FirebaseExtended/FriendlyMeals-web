import { useRef, type FC } from "react";
import { href, useNavigation, useSearchParams } from "react-router";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export const SearchBar: FC = () => {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const urlQuery = searchParams.get("q") || "";
  const isSearching =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath &&
    (new URLSearchParams(navigation.location.search).get("q") || "") !==
      urlQuery.trim();

  return (
    <search aria-label="Search recipes" className="relative">
      {isSearching ? (
        <Spinner className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      ) : (
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Input
        ref={inputRef}
        id="recipe-search"
        name="q"
        type="search"
        aria-label="Search recipes"
        placeholder="Search recipes by title, ingredient, or tag..."
        defaultValue={urlQuery}
        className="peer h-11 rounded-md bg-card pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="button"
        onClick={() => {
          if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.focus();
            inputRef.current.form?.requestSubmit();
          }
        }}
        aria-label="Clear search"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground peer-placeholder-shown:hidden"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </search>
  );
};
