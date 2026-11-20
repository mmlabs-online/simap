/**
 * The one swappable art slot of the sign-in surface (D52). Today a CSS placeholder; SIM-024 replaces the body with
 * the `scene.signin` sprite. Decorative: hidden from assistive tech, no text. A future `<img>` needs an `alt` from
 * copy (or a `// copy-ok: decorative` empty alt).
 */
export function SignInScene() {
  return <div aria-hidden="true" className="px-scene hidden md:block" />;
}
