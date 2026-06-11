// app.jsx — Ponti prototype app: navigation, flow orchestration, mock mutations, tweaks.
const { useState: useA, useMemo: useMA } = React;

// accent palettes: [lightAccent, lightStrong, lightSoft, darkAccent, darkSoft]
const ACCENTS = {
  Raspberry: ["#B23A6B", "#A1305F", "#F8E4ED", "#E36796", "#36202B"],
  Clay:      ["#C0563E", "#A8492E", "#F7E5DD", "#E08A66", "#38261E"],
  Plum:      ["#8A4D9E", "#793F8C", "#F0E6F5", "#C78FD8", "#2E2436"],
  Magenta:   ["#C23069", "#AC2A5E", "#FAE2EC", "#F06A9C", "#38202C"],
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#B23A6B", "#A1305F", "#F8E4ED", "#E36796", "#36202B"],
  "dark": false,
  "corners": "sharp",
  "flowTone": "wink",
  "homeState": "normal",
  "lowUsdc": false
}/*EDITMODE-END*/;

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// scales the fixed-size device down to fit short viewports
function Stage({ children }) {
  const [scale, setScale] = useA(1);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 24) / 874));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div style={{ width: 402 * scale, height: 874 * scale }}>
      <div style={{ width: 402, height: 874, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useA("signin");      // signin | home | detail | create | add
  const [data, setData] = useA(() => deepClone(window.PONTI_DATA));
  const [gid, setGid] = useA(null);
  const [flow, setFlow] = useA(null);              // active FlowSheet descriptor
  const [postWrite, setPostWrite] = useA(null);
  const [editing, setEditing] = useA(null);        // expense being edited
  const [addFunds, setAddFunds] = useA(false);     // Add funds panel (faucet)

  const g = useMA(() => data.groups.find((x) => x.id === gid) || null, [data, gid]);

  // theme tokens
  const [aL, aStrong, aSoftL, aD, aSoftD] = t.accent;
  const radius = 6;
  const radiusSm = 4;
  const rootStyle = {
    "--accent": t.dark ? aD : aL,
    "--accent-strong": t.dark ? aD : aStrong,
    "--accent-soft": t.dark ? aSoftD : aSoftL,
    "--accent-ink": t.dark ? "#1A1115" : "#FFFFFF",
    "--radius": radius + "px",
    "--radius-sm": radiusSm + "px",
  };

  // ── post-write resilient refresh (grey, never red) ──
  function reassure() {
    setPostWrite("Saved — updating your activity…");
    setTimeout(() => setPostWrite(null), 1700);
  }

  // ── mock mutations ──
  function applyAdd({ payer, amt, desc }) {
    const amount = parseFloat(amt);
    setData((d) => {
      const nd = deepClone(d);
      const grp = nd.groups.find((x) => x.id === gid);
      const mine = payer === "me";
      grp.balance += mine ? amount : -amount;
      grp.lastActivity = "just now";
      (nd.timeline[gid] = nd.timeline[gid] || []).push({
        kind: "expense", id: Date.now(), payer: mine ? "You" : grp.nickname, mine, amount, desc, at: "Today",
      });
      return nd;
    });
  }
  function applySettle() {
    setData((d) => {
      const nd = deepClone(d);
      const grp = nd.groups.find((x) => x.id === gid);
      const amt = Math.abs(grp.balance);
      nd.timeline[gid].push({ kind: "settle", id: "s" + Date.now(), by: "You", amount: amt, at: "Today" });
      grp.balance = 0;
      return nd;
    });
  }
  function applyEdit(orig, form) {
    const amount = parseFloat(form.amt);
    const mine = form.payer === "me";
    setData((d) => {
      const nd = deepClone(d);
      const grp = nd.groups.find((x) => x.id === gid);
      const list = nd.timeline[gid] || [];
      const it = list.find((x) => x.id === orig.id);
      if (it) {
        // undo old contribution, apply new
        grp.balance -= it.mine ? it.amount : -it.amount;
        grp.balance += mine ? amount : -amount;
        it.amount = amount; it.desc = form.desc; it.mine = mine;
        it.payer = mine ? "You" : grp.nickname; it.edited = { who: "You", at: "Today" };
      }
      return nd;
    });
  }

  // ── add funds (wallet top-up via testnet faucet) ──
  function applyAddFunds(amount) {
    setData((d) => {
      const nd = deepClone(d);
      nd.me.usdc = (nd.me.usdc || 0) + amount;
      return nd;
    });
  }

  // ── flow launchers ──
  function launchAdd(form) {
    setScreen("detail");
    setFlow({
      kind: "add", title: "Add this expense", runningTitle: "Adding expense", who: g ? g.nickname : "them",
      confirmLabel: "Add expense", doneSub: "Expense added to your shared tab.",
      doneSubWink: "On the tab. Future-you will thank present-you.",
      doneSubPlayful: "Logged. The tab remembers so you don't have to.",
      rows: [
        { label: "What", value: form.desc || "Expense" },
        { label: "Paid by", value: form.payer === "me" ? "You" : (g ? g.nickname : "Them") },
        { label: "Amount", value: `${money(parseFloat(form.amt || 0))} USDC`, strong: true },
      ],
      _commit: () => applyAdd(form),
    });
  }
  function launchSettle() {
    setFlow({
      kind: "settle", title: `Settle with ${g.nickname}`, runningTitle: "Settling up", who: g.nickname,
      confirmLabel: `Settle ${money(Math.abs(g.balance))} USDC`, doneSub: "Balance is back to zero.",
      doneSubWink: `You and ${g.nickname} are even again.`,
      doneSubPlayful: `Even again — your tab and ${g.nickname}'s finally agree.`,
      rows: [
        { label: "To", value: g.nickname },
        { label: "You pay", value: `${money(Math.abs(g.balance))} USDC`, strong: true },
        { label: "After", value: "Settled · 0.00" },
      ],
      _commit: () => applySettle(),
    });
  }
  function launchCreate({ nick }) {
    setScreen("home");
    setFlow({
      kind: "create", title: "Create group", runningTitle: "Creating group", who: nick,
      confirmLabel: "Create group", doneSub: `Your shared tab with ${nick} is ready.`,
      doneSubPlayful: `You and ${nick} have a shared tab now. Try not to fight over it.`,
      rows: [
        { label: "With", value: nick },
        { label: "Shared tab", value: "Private · just you two", strong: true },
      ],
      _commit: () => {},
    });
  }
  function launchDelete(e) {
    setFlow({
      kind: "delete", title: "Delete expense", runningTitle: "Deleting", who: g ? g.nickname : "them",
      confirmLabel: "Delete expense", doneSub: "Removed — the history still remembers it.",
      rows: [{ label: "What", value: e.desc }, { label: "Amount", value: `${money(e.amount)} USDC`, strong: true }],
      _commit: () => {},
    });
  }
  function launchEdit(e) { setEditing(e); setScreen("edit"); }
  function submitEdit(form) {
    setScreen("detail");
    setFlow({
      kind: "edit", title: "Save changes", runningTitle: "Saving", who: g ? g.nickname : "them",
      confirmLabel: "Save changes", doneSub: "Expense updated.",
      doneSubPlayful: "Updated. The tab's memory is better than ours.",
      rows: [
        { label: "What", value: form.desc || "Expense" },
        { label: "Paid by", value: form.payer === "me" ? "You" : (g ? g.nickname : "Them") },
        { label: "Amount", value: `${money(parseFloat(form.amt || 0))} USDC`, strong: true },
      ],
      _commit: () => editing && applyEdit(editing, form),
    });
  }

  function onFlowComplete() {
    if (flow && flow._commit) flow._commit();
    reassure();
  }

  // ── render current screen ──
  let body;
  if (screen === "signin") body = <SignIn onLogin={() => setScreen("home")} />;
  else if (screen === "home") body = (
    <Home data={data} demoState={t.homeState}
      onOpenGroup={(grp) => { setGid(grp.id); setScreen("detail"); }}
      onCreate={() => setScreen("create")} onProfile={() => setScreen("profile")}
      onAddFunds={() => setAddFunds(true)} />
  );
  else if (screen === "detail" && g) body = (
    <GroupDetail g={g} data={data} postWrite={postWrite} lowUsdc={t.lowUsdc}
      onBack={() => { setScreen("home"); setPostWrite(null); }}
      onAdd={() => setScreen("add")} onSettle={launchSettle}
      onEditExpense={launchEdit} onDeleteExpense={launchDelete}
      onAddFunds={() => setAddFunds(true)} />
  );
  else if (screen === "create") body = <CreateGroup onBack={() => setScreen("home")} onSubmit={launchCreate} onShare={() => setScreen("profile")} />;
  else if (screen === "profile") body = <Profile me={data.me} onBack={() => setScreen("home")} onLogout={() => { setScreen("signin"); setGid(null); }} onAddFunds={() => setAddFunds(true)} dark={t.dark} onToggleTheme={(v) => setTweak("dark", v)} />;
  else if (screen === "add" && g) body = <AddExpense g={g} onBack={() => setScreen("detail")} onSubmit={launchAdd} />;
  else if (screen === "edit" && g) body = <AddExpense g={g} mode="edit" initial={editing} onBack={() => setScreen("detail")} onSubmit={submitEdit} />;
  else body = <Home data={data} demoState="normal" onOpenGroup={() => {}} onCreate={() => {}} />;

  return (
    <div className={"ponti-root theme-" + (t.dark ? "dark" : "light")} style={rootStyle}>
      <Stage>
        <IOSDevice dark={t.dark}>
          <div style={{ position: "relative", minHeight: "100%", paddingTop: 52 }}>
            {body}
            {flow && <FlowSheet flow={flow} tone="wink"
              onClose={() => setFlow(null)} onComplete={onFlowComplete} />}
            {addFunds && <AddFundsPanel me={data.me} placement="sheet"
              onReceived={applyAddFunds} onClose={() => setAddFunds(false)} />}
          </div>
        </IOSDevice>
      </Stage>

      <TweaksPanel>
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent}
          options={Object.values(ACCENTS)}
          onChange={(v) => setTweak("accent", v)} />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />

        <TweakSection label="Demo states" />
        <TweakSelect label="Home" value={t.homeState} options={["normal", "loading", "empty", "error"]}
          onChange={(v) => setTweak("homeState", v)} />
        <TweakToggle label="Settle: low USDC" value={t.lowUsdc} onChange={(v) => setTweak("lowUsdc", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
