# CardWise

CardWise helps people in Canada pick the credit cards that fit how they actually
spend. You upload a card statement (CSV) and CardWise sorts each purchase into a
spending category. It then works out which combination of Canadian cards gives
you the most value after annual fees, and which card to use for each category.
It also explains the trade-offs: what each card adds, what you give up by
choosing a different card, and how sensitive the answer is to your assumptions.

All amounts are in Canadian dollars.

> **Status:** redesign in progress. Statement import, categorization, the benefits report, the statement check, "Earn more" recommendations, redemption values and benefit reminders work. The card catalogue is waiting for verified card terms.


## Privacy

- **Your statements never leave your browser.** CSV files are read and processed on your device. There is no server endpoint that receives transaction data, and the app makes no network requests with it.
- **No analytics or tracking** runs on your transactions, merchants or spending totals.
- **The only thing the page downloads for recommendations is the optimizer itself.** The open-source HiGHS solver is fetched once from this site. The optimization then runs in your browser, and nothing about your spending is sent anywhere. The site's security policy blocks connections to any other server.
- **Nothing from your statement is saved,** except the category corrections you make and, per card, which rounding method matched your statement. Both are stored in your own browser's local storage: merchant name → category, and one word for rounding. No amounts or dates are stored. You can clear corrections from the card's panel at any time. Everything else is gone when you close the tab.

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
- A terminal and a browser. No database, account or API key is needed — everything runs locally.

### 1. Clone and install

```bash
git clone https://github.com/ayaanmohsin066/cardwise.git
cd cardwise
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
   the issuer's own page appear in the list — if a card isn't listed yet, its data hasn't been
   checked yet (see [Card data](#card-data) below).
2. **Import a statement per card.** For each card you added, a statement panel appears. Upload
   that card's CSV export from your bank. If the bank's column layout is recognized, it's mapped
   automatically; otherwise you'll be asked to match the file's columns (date, description,
   amount) yourself. The file is read with your browser's own file reader and is never uploaded
   anywhere — see [Privacy](#privacy).
3. **Review the categorization.** Each transaction is sorted into a spending category (groceries,
   dining, gas, etc.) by merchant. If something's miscategorized, correct it in the review table —
   your correction is remembered for that merchant on that card (saved only in your browser's
   local storage) so you won't have to fix it again next time.
4. **Read the benefits report.** For each card, you'll see points or cash back earned by category,
   any caps you're approaching or have hit, statement credits used, and an overall net value after
   the annual fee. Anything the issuer hasn't published is shown as "not yet verified" rather than
   guessed.
5. **Compare cards side by side.** If you added more than one card, an "All cards" section shows
   them together so you can see which card earned the most from which category.
6. **Check "Earn more."** This section runs an optimizer (entirely in your browser, via a
   WebAssembly solver fetched once from this same site) over your actual transactions to show
   whether routing purchases to a different card in your set — or swapping in a different
   card — would have earned more, and by how much.

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
