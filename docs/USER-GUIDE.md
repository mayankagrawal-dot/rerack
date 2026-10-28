# Rerack user guide

For the owner of a clothing or footwear chain. No technical knowledge needed.

Rerack takes each store's stock file and gives you a short list of things to **move** between stores or **mark down**, with the numbers behind each one. **You** decide. Rerack never moves stock or changes a price.

---

## 1. Your first two minutes

1. Open the app. On the first page, press **Explore the demo**. This loads a made-up chain called Northstar Apparel (5 stores, about 300 stock lines) so you can look around. It is not real data.
2. Press **Review this week's actions**. You'll see up to 10 cards.
3. On any card press **Evidence** to see the numbers, then try **Approve**, **Edit** or **Reject**.
4. Open **Activity & Reports** to see a time-stamped record of what you just did.

To clear the demo, open **Activity & Reports** and press **Clear data on this device**.

## 2. Using your own stores' data

### Prepare one file per store

Each store needs one CSV file (a spreadsheet saved as "CSV"). Use these column names in the first row:

| Column | What goes in it | Example |
|---|---|---|
| `item` | The product | Kurta |
| `size` | The size | M |
| `colour` | The colour | Navy |
| `date_received` | When this stock arrived | 2026-08-20 or 20/08/2026 |
| `units_on_hand` | How many are in the store now | 8 |
| `units_sold` | How many sold in the period you'll choose in step 3 | 14 |

Numbers must be whole numbers, 0 or more (`1,200` and `12.00` are fine). Dates can be written 2026-08-20, 20/08/2026 or 20-Aug-2026. On **Data Imports** you can press **Sample CSV template** to download a ready-made example.

**Using your billing software's export as it is.** If your file has its own column names (for example "Product Name", "Closing Stock", "Sales Qty"), upload it anyway. Rerack guesses which column is which and shows a **Match this file's columns** panel under the file. Check each dropdown, and change any that are wrong. Your choice is used for every file with the same columns, and remembered on this device for next time. Other columns, such as barcode or MRP, are ignored.

Each store's file name becomes its store name (`whitefield.csv` becomes "Whitefield"). You can rename it on screen.

### Import

1. Go to **Data Imports**.
2. Drag the files in, or press **Browse files**. Each file shows **Ready**, a warning, or a problem. Press **Preview** to see its first rows.
3. **Choose the sales window** (next section).
4. Optionally write a note, such as "Diwali in 3 weeks" or "Store B is closed for repairs". The AI reads it.
5. Press **Process data**. It takes a few seconds.

If a file has a problem, Rerack tells you the file, the row and the fix, and won't process until it's fixed. **Warnings** (a duplicate file, repeated rows) don't block you.

## 3. The sales window, in plain words

Your files hold **one sales total per line**, not sales per day. So Rerack needs you to say **which dates that total covers**.

- Press the **Sales window** button on the first page, or use step 2 on **Data Imports**.
- Pick **Last 2, 4, 6, 8 or 12 weeks**, or enter your own **From** and **To** dates (7 to 366 days, ending today or earlier).
- It must match how you exported your files. If your files cover the last 8 weeks, choose 8 weeks. If you choose something else, the weekly sales rates, and so every suggestion, will be wrong in proportion.

Changing the window on data you've already loaded **re-runs everything** and **clears the decisions you've recorded**, because the suggestions can change. Rerack tells you before it does.

## 4. Reading an action card

Each card is one suggested action.

- **Transfer** means move stock from a store where it isn't selling to a store that is selling it and running low.
- **Markdown review** means this item is old everywhere and selling slowly, so consider a discount. The 15% is a starting point, not a prediction.
- **Priority** is just the position in this week's list: the first three are High.
- **Evidence strength** (Strong, Moderate, Limited) is a simple rule based on how much the numbers back the action. It is **not** an AI score.
- **Why, written by the AI** is the AI's one-line reason. If it says **from rules (not AI)**, the AI wasn't available and a rule wrote it.
- A red **⚠ check numbers** tag means the sentence quotes a number Rerack didn't calculate. Trust the figures in the **Evidence** panel, not the sentence.

Press **Evidence** to see:
- every store's figures (on hand, sold, per week, stock cover, sell-through, days since receipt),
- **how the suggestion was worked out**, step by step,
- **what this data can't tell you**.

### Making a decision

| Button | What happens |
|---|---|
| **Approve** | Asks you to confirm, then records your decision with the time. |
| **Edit** | Change the quantity (transfers) or the discount (markdowns). You see what it would do to each store before you save, then it approves. |
| **Reject** | Optionally give a reason. It is recorded. |
| **Undo** | Removes a decision if you tapped the wrong button. |

After you approve a **transfer**, it shows **Approved · awaiting stock verification**. Count the physical stock at the sending store, then press **Mark stock verified**. A **copyable transfer note** appears. Rerack doesn't send it anywhere.

> Approving only **records your decision** in Rerack. You move the stock and change the price yourself.

### Items the AI left out

If your note rules something out (for example "don't mark down Navy Kurta"), the AI can leave that action out. It then appears under **Left out by the AI**, with its reason, and you can still review it.

## 5. The other pages

| Page | Use it to |
|---|---|
| **Overview** | See the whole picture: six headline numbers, charts, and your top 5 priorities. |
| **Inventory** | Search and filter every store's stock (by store, product, size, colour, age, risk). Click a row for the full story of that item. |
| **Stores** | Compare stores: where each product sells and where it gets stuck. |
| **Activity & Reports** | See what was imported and decided, data-quality problems, and the biggest at-risk stock. |
| **Rules** | See and change the thresholds behind every flag. |

### Chart dates

The charts on **Overview** and **Stores** have a **Chart dates** bar. It limits the charts to stock **received** in a range (the quick choices match the age buckets: 0-30, 31-60, 61-90, over 90 days; or enter dates). The headline numbers at the top always cover all stock. Sales can't be filtered by date, because the files have one total per line.

## 6. What the words mean

| Term | Meaning |
|---|---|
| **Line** | One store's stock of one item, size and colour. |
| **Days since receipt** | Today minus the `date_received`. It may not equal the true age of the stock if you restocked. |
| **Weekly sales** | Units sold ÷ the number of weeks in your sales window. |
| **Stock cover** | Units on hand ÷ weekly sales: how many weeks the stock lasts. "No sales" means nothing sold, so it can't be worked out. It is never divided by zero. |
| **Sell-through** | Sold ÷ (sold + on hand). How much of what was available has sold. |
| **At risk** | Old stock, lots of cover (or no sales). Candidate for a markdown. |
| **Watch** | Getting old with plenty of cover. May be worth a transfer. |
| **Fast seller** | Selling, with little stock left. Often a destination for transfers. |
| **Too new to judge** | Received too recently to tell. |

The exact numbers behind these (45 days, 8 weeks, and so on) are on the **Rules** page.

## 7. Limits to know about

- Rerack only knows what's in your files. If a file is out of date, or the system's count differs from the shelf, the suggestions will be off. That is why every transfer needs a physical count.
- **No money figures.** The files have no price or cost, so Rerack shows no ₹ values or profit.
- **Zero sales is not proof of zero demand.** The evidence panel says so wherever it matters.
- Your data, decisions and activity are saved **in your browser only**. They survive a refresh, but they don't follow you to another device, and clearing browser data removes them.
- The AI is only as good as its instructions. It can occasionally misread a note. That's why anything it drops is shown to you.

## 8. A two-minute demo script

1. **First page.** "Rerack tells a shop owner what to move and what to mark down." Press **Explore the demo**.
2. **Overview.** Point at the headline numbers. "Every number is calculated by code. The AI never does the maths."
3. **Sales window.** Open it. "Owners say which dates the sales cover, and everything recalculates." Change it to 8 weeks to show the numbers move.
4. **Action Centre.** Open the **Navy Kurta** transfer. "Jayanagar has 12 sitting unsold for 12 weeks. Whitefield sold 14 in four weeks." (These figures are for the default 4-week window. If you changed the window, the numbers and the ranking will differ.) Press **Evidence** to show the working and the limits.
5. **Edit and approve.** Change the quantity, watch the preview, approve, then mark stock verified. "It never moves stock itself."
6. **Activity & Reports.** Show the time-stamped log.
7. **The note.** Show "Don't mark down Navy Kurta" and the **Left out by the AI** section. "The AI is told what the data can't know, and it shows what it dropped."
