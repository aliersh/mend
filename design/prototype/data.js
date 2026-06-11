// data.js — mock domain data for the Ponti prototype (English copy)
// Balance sign convention mirrors the contract: positive = the OTHER person owes you.

window.PONTI_DATA = {
  me: { nickname: "You", initial: "Y", displayName: "Ariel", email: "ariel@email.com",
        address: "0x9F2c…A41e", fullAddress: "0x9F2c4D7b3A8e1F05c6D2940bE7a3C81f2be4A41e",
        // usdc = account-level balance you hold in your own Ponti (distinct from
        // the per-person tabs). 14.00 leaves you short of the 28.00 owed to Cami,
        // so the low-USDC settle gate has a real deficit; adding funds clears it.
        usdc: 14.0,
        network: "Base", accountType: "Smart account", explorer: "basescan.org/address/0x9F2c…A41e" },

  groups: [
    {
      id: "g-cami",
      nickname: "Cami",
      initial: "C",
      label: "Apartment",
      address: "0x7C6c…b210",
      // you owe Cami → negative
      balance: -28.0,
      lastActivity: "2h ago",
      tone: "accent",
    },
    {
      id: "g-dad",
      nickname: "Dad",
      initial: "D",
      label: "US ↔ Chile",
      address: "0x1746…Cb21",
      // dad owes you → positive
      balance: 120.0,
      lastActivity: "yesterday",
      tone: "neutral",
      crossBorder: true,
    },
    {
      id: "g-sam",
      nickname: "Sam",
      initial: "S",
      label: "Trips",
      address: "0x4A0f…77c2",
      balance: 0,
      lastActivity: "5 days ago",
      tone: "neutral",
    },
  ],

  // expense history for the Cami group, oldest → newest.
  // a "settle" entry acts as a timeline divider; items before it are squared away.
  timeline: {
    "g-cami": [
      { kind: "expense", id: 1, payer: "Cami", mine: false, amount: 36.0, desc: "Groceries", at: "Mar 2", settledBlock: true },
      { kind: "expense", id: 2, payer: "You", mine: true, amount: 12.0, desc: "Internet", at: "Mar 4", settledBlock: true, edited: { who: "You", at: "Mar 4" } },
      { kind: "settle", id: "s1", by: "You", amount: 24.0, at: "Mar 5" },
      { kind: "expense", id: 3, payer: "Cami", mine: false, amount: 18.0, desc: "Dinner", at: "Mar 9" },
      { kind: "expense", id: 4, payer: "Cami", mine: false, amount: 22.5, desc: "Electricity", at: "Mar 12" },
      { kind: "expense", id: 5, payer: "You", mine: true, amount: 12.5, desc: "Cleaning", at: "Mar 14" },
    ],
    "g-dad": [
      { kind: "expense", id: 1, payer: "You", mine: true, amount: 120.0, desc: "Flight home", at: "Mar 10" },
    ],
    "g-sam": [
      { kind: "expense", id: 1, payer: "Sam", mine: false, amount: 40.0, desc: "Hotel", at: "Feb 1", settledBlock: true },
      { kind: "settle", id: "s1", by: "Sam", amount: 40.0, at: "Feb 3" },
    ],
  },
};
