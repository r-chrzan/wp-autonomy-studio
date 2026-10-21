import type { ReactNode } from "react";

type HeroProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

/** DaisyUI hero block for frontend pages. */
export function Hero({ title, description, actions }: HeroProps) {
  return (
    <section className="hero bg-base-200 min-h-[60vh]">
      <div className="hero-content text-center">
        <div className="max-w-xl">
          <h1 className="text-5xl font-bold">{title}</h1>
          <p className="py-6">{description}</p>
          {actions}
        </div>
      </div>
    </section>
  );
}
