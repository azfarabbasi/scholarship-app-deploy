import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";

/** Shared shell for Checkpoint 6's static legal/informational pages — keeps heading structure and prose styling consistent with /privacy. */
export function ContentPage({ title, lastReviewed, children }: { title: string; lastReviewed?: string; children: ReactNode }) {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
      {lastReviewed ? <p className="mt-2 text-sm text-foreground-muted">{lastReviewed}</p> : null}
      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-foreground-muted">{children}</div>
    </Container>
  );
}

export function ContentSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}
