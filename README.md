# CardOpt V2 (CardWise)

CardWise tells you which Canadian credit cards to hold and which card to use for each purchase, based on how you actually spend.

You upload a card statement as a CSV. CardWise sorts each purchase into one of 12 spending categories, like groceries, dining, gas and travel. Then it works out which mix of cards earns you the most after annual fees, and which card to tap for each category. It also shows the trade-offs: what each card adds, what you give up by picking a different one, and how much the answer changes if a point is worth more or less.

Everything is in Canadian dollars, and your statement never leaves your browser.

## Who it's for

- People in Canada deciding which credit card to apply for next.
- People with two or three cards who want to know which one to use where.
- Anyone who wants to check that a card actually paid what it promised on last month's statement.

## What's new in V2

V1 is the original CardOpt by @srinihal007, a Python and Streamlit app. It's kept in [`legacy/`](legacy/) for credit and reference. V1 only covered US cards, US categories and USD, and it pulled bank data through Plaid.

V2 is a full rebuild:

- Canada only. 21 Canadian cards from 11 issuers, with every term taken from the issuer's official page and a link back to it.
- Runs in the browser. Next.js and TypeScript, with no server that ever sees your transactions.
- Real optimizer. Card choice is a mixed-integer linear program (a math model that picks which cards to hold with yes/no variables). It's solved in your browser with the open-source HiGHS solver. It handles spending caps, annual fees and income requirements.
- Checks your statement. It recomputes the points or cash back each card should have paid and flags gaps.
- Never guesses card terms. Anything the issuer hasn't published shows as "not yet verified".
- 430 automated tests (Vitest).

> **Status:** statement import, categorization, the benefits report, the statement check, "Earn more" recommendations, redemption values and benefit reminders all work. Bank formats are still mostly mapped by hand: only RBC is filled in for you, and that layout comes from public pages, not a real export. Categorization accuracy hasn't been measured yet, because there's no hand-labelled test set. See [`docs/claims.md`](docs/claims.md).

## Privacy

- **Your statements never leave your browser.** CSV files are read and processed on your device. There is no server endpoint that receives transaction data, and the app makes no network requests with it.
- **No analytics or tracking** runs on your transactions, merchants or spending totals.
- **The only thing the page downloads for recommendations is the optimizer itself.** The open-source HiGHS solver is fetched once from this site. The optimization then runs in your browser, and nothing about your spending is sent anywhere. The site's security policy blocks connections to any other server.
- **Nothing from your statement is saved,** except the category corrections you make and, per card, which rounding method matched your statement. Both are stored in your own browser's local storage: merchant name to category, and one word for rounding. No amounts or dates are stored. You can clear corrections from the card's panel at any time. Everything else is gone when you close the tab.

## Card data

Card terms come from each issuer's official page. Every card file records its
`source_url` and a `last_verified` date. If a term hasn't been verified yet, the
app shows it as **"not yet verified"** and never guesses. Terms change, so check
the issuer's page before you apply.

To add a card, run `npm run new-card -- <issuer> <card-id>`. It creates a file with every field set to `null`, and you fill in only what the issuer's page states. `npm run card-status` flags cards whose terms haven't been re-checked in 180 days.

CardWise is an educational tool, not financial advice. Benefit reminders repeat the card's own terms and are for information only.

## Running it on your own machine

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer (this repo is built and tested on Node 22).
- `npm` (installed alongside Node).
- A terminal and a browser. No database, account or API key is needed Everything runs locally.

### 1. Clone and install

```bash
git clone https://github.com/ayaanmohsin066/cardopt.git
cd cardopt
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

This also runs a `predev` step that copies the bundled solver (used by "Earn more") into
`public/solver/`. Once you see `Ready` in the terminal, open **http://localhost:3000**.

### 3. Use the app

1. **Add your cards.** In the "Your cards" panel, pick an issuer and one of its cards, then
   **Add card**. You can add up to 3 cards. Only cards whose terms have been verified against
   the issuer's own page appear in the list. If a card isn't listed, its data hasn't been
   checked yet (see [Card data](#card-data)).
2. **Import a statement per card.** For each card you added, a statement panel appears. Upload
   that card's CSV export from your bank, then match the file's columns (date, description,
   amount). For RBC the columns are filled in for you, from a layout described on public pages.
   It hasn't been checked against a real RBC export yet, so look it over. The file is read in
   your browser and never uploaded (see [Privacy](#privacy)).
3. **Review the categorization.** Each transaction is sorted into a spending category (groceries,
   dining, gas and so on) by merchant. If one is wrong, correct it in the review table. Your correction is remembered for that merchant on that card (saved only in your browser's
   local storage) so you won't have to fix it again next time.
4. **Read the benefits report.** For each card, you'll see points or cash back earned by category,
   any caps you're approaching or have hit, statement credits used, and an overall net value after
   the annual fee. Anything the issuer hasn't published is shown as "not yet verified" rather than
   guessed.
5. **Compare cards side by side.** If you added more than one card, an "All cards" section shows
   them together so you can see which card earned the most from which category.
6. **Check "Earn more."** This section runs an optimizer (entirely in your browser, via a
   WebAssembly solver fetched once from this same site) over your actual transactions. It shows
   whether using a different card from your set for some purchases, or swapping in a different
   card, would have earned more, and by how much.

Nothing you upload or correct is sent to a server at any point; re-read [Privacy](#privacy) if
you want the specifics on what is and isn't stored.

### Other commands

```bash
npm test         # Vitest
npm run lint
npm run typecheck
npm run build    # production build
npm run card-status      # flags cards with null fields or stale verification
npm run program-status
```

The project rules are in [`CLAUDE.md`](CLAUDE.md).
