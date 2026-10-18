import { Importer } from "./components/Importer";
import { SHELL } from "./components/SiteChrome";
import { loadCatalog } from "./lib/catalog";

export default function Home() {
  const catalog = loadCatalog();
  return (
    <main id="main" className={`${SHELL} flex flex-1 flex-col gap-8 pb-16 pt-10 sm:pt-14`}>
      <header className="flex flex-col gap-4">
        <p className="eyebrow">Canadian credit card optimizer</p>
        <h1 className="max-w-3xl text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-5xl sm:leading-[1.05]">
          See what your cards earn, and where they could earn more
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg">
          Import your credit card statements to see where your money goes. Your files are read in
          this browser and are never uploaded.
        </p>
      </header>
      <Importer catalog={catalog} />
    </main>
  );
}
