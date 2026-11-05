import { href, redirect } from "react-router";

export function loader() {
  return redirect(href("/recipes"));
}

export function clientLoader() {
  return redirect(href("/recipes"));
}
