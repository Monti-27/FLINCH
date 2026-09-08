"use client";

import { BrandLogo } from "../components/brand/logo.tsx";
import { Button } from "../components/ui/button.tsx";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main><section className="panel brand-message" role="alert"><BrandLogo className="brand-status" /><h1>The room view stopped.</h1><p>This does not cancel a submitted transaction. Reload and check its status before signing again.</p>
    <Button onClick={reset}>Reload view</Button></section></main>;
}
