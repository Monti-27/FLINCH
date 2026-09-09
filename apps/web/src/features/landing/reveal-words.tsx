import { Fragment } from "react";

export function RevealWords({ children }: { children: string }) {
  return <>{children.split(" ").map((word, index) => <Fragment key={`${index}-${word}`}>
    {index > 0 ? " " : null}<span data-word="">{word}</span>
  </Fragment>)}</>;
}
