import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FaqAccordion } from "../src/features/landing/faq-accordion.tsx";
import { questions } from "../src/features/landing/landing-details.tsx";

describe("reference FAQ", () => {
  it("server-renders all five original answers as native disclosures", () => {
    const html = renderToStaticMarkup(<FaqAccordion questions={questions} />);
    expect(html).toMatch(/^<div class="[^"]+" data-faq="">/);
    const text = html.replace(/<[^>]*>/g, "");
    expect(html.match(/<details\b/g)).toHaveLength(5);
    expect(html.match(/<summary\b/g)).toHaveLength(5);
    for (const { question, answer } of questions) {
      expect(text).toContain(question);
      expect(text).toContain(answer);
    }
    expect(html).not.toMatch(/style=|inert=|data-enhanced=|aria-expanded=|<canvas/);
  });

  it("pairs every summary with one answer and hides decorative icons from assistive technology", () => {
    const html = renderToStaticMarkup(<FaqAccordion questions={questions} />);
    for (let index = 0; index < questions.length; index++) {
      expect(html).toContain(`aria-controls="faq-answer-${index}"`);
      expect(html.match(new RegExp(`id="faq-answer-${index}"`, "g"))).toHaveLength(1);
    }
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(15);
    expect(html).not.toContain("tabindex");
  });
});
