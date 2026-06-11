// desktop-app.jsx — Ponti desktop deliverable: shared orchestration, mobile/desktop
// toggle, FlowWidget placement, and the Tweaks panel. Reuses mobile screens
// (screens.jsx) for the mobile view so both live in one file.
const { useState: useDA, useMemo: useDMA } = React;

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
  "view": "desktop",
  "layout": "split",
  "contentWidth": "wide",
  "flowPlace": "modal",
  "flowTone": "wink",
  "auth": "in",
  "homeState": "normal",
  "lowUsdc": false
}/*EDITMODE-END*/;

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// scale the browser window to fit the viewport (width + height)
function DesktopStage({ w, h, children }) {
  const [scale, setScale] = useDA(1);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 40) / w, (window.innerHeight - 40) / h));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [w, h]);
  return (
    <div style={{ width: w * scale, height: h * scale }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

// scale the fixed phone to fit short viewports
function MobileStage({ children }) {
  const [scale, setScale] = useDA(1);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 24) / 874));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div style={{ width: 402 * scale, height: 874 * scale }}>
      <div style={{ width: 402, height: 874, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

// lightweight "Add someone" modal for desktop (mobile uses the full CreateGroup screen)
function AddSomeoneModal({ onClose, onSubmit }) {
  const [nick, setNick] = useDA("");
  const [link, setLink] = useDA("");
  const ok = nick.trim() && link.trim().length > 4;
  return (
    <ModalShell onClose={onClose} width={440}>
      <div style={{ padding: "22px 26px 26px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Add someone</h2>
            <p style={{ margin: "4px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--muted)", maxWidth: 320, lineHeight: 1.45 }}>Connect with one person to start a shared tab. Nothing moves until you choose to settle.</p>
          </div>
          <button onClick={onClose} className="dk-hover-icon" style={{ all: "unset", cursor: "pointer", color: "var(--muted)", padding: 6, borderRadius: 8 }}>{DI.close("var(--muted)")}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <Field label="What will you call them?" hint="Just for you — only you ever see this name.">
            <Input placeholder="e.g. Cami" value={nick} onChange={(e) => setNick(e.target.value)} />
          </Field>
          <Field label="Their Ponti invite" hint="Paste the link they sent you, or scan their code.">
            <Input placeholder="ponti.money/c/…" value={link} onChange={(e) => setLink(e.target.value)} />
          </Field>
          <Button variant="primary" full disabled={!ok} onClick={() => onSubmit({ nick })}>Add {nick.trim() || "them"}</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useDA("home");        // mobile: signin|home|detail|create|profile|add ; desktop uses home|detail
  const [data, setData] = useDA(() => deepClone(window.PONTI_DATA));
  const [gid, setGid] = useDA(null);
  const [flow, setFlow] = useDA(null);
  const [postWrite, setPostWrite] = useDA(null);
  const [addOpen, setAddOpen] = useDA(false);        // desktop add-expense modal
  const [createOpen, setCreateOpen] = useDA(false);  // desktop add-someone modal
  const [profileOpen, setProfileOpen] = useDA(false);// desktop your-ponti modal
  const [editExpense, setEditExpense] = useDA(null); // desktop edit-expense modal
  const [addFundsOpen, setAddFundsOpen] = useDA(false); // Add funds panel (faucet)

  const g = useDMA(() => data.groups.find((x) => x.id === gid) || null, [data, gid]);
  const desktop = t.view === "desktop";

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

  function reassure() {
    setPostWrite("Saved — updating your activity…");
    setTimeout(() => setPostWrite(null), 1700);
  }

  // ── mutations ──
  function applyAdd({ payer, amt }, desc) {
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
      const it = (nd.timeline[gid] || []).find((x) => x.id === orig.id);
      if (it) {
        grp.balance -= it.mine ? it.amount : -it.amount;
        grp.balance += mine ? amount : -amount;
        it.amount = amount; it.desc = form.desc; it.mine = mine;
        it.payer = mine ? "You" : grp.nickname; it.edited = { who: "You", at: "Today" };
      }
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
      _commit: () => applyAdd(form, form.desc || "Expense"),
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
    if (!desktop) setScreen("home");
    setFlow({
      kind: "create", title: "Add someone", runningTitle: "Setting up", who: nick,
      confirmLabel: "Add " + nick, doneSub: `Your shared tab with ${nick} is ready.`,
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
  function launchEdit(e) { setEditExpense(e); if (!desktop) setScreen("edit"); }
  function submitEdit(form) {
    const orig = editExpense; setEditExpense(null); setScreen("detail");
    setFlow({
      kind: "edit", title: "Save changes", runningTitle: "Saving", who: g ? g.nickname : "them",
      confirmLabel: "Save changes", doneSub: "Expense updated.",
      doneSubPlayful: "Updated. The tab's memory is better than ours.",
      rows: [
        { label: "What", value: form.desc || "Expense" },
        { label: "Paid by", value: form.payer === "me" ? "You" : (g ? g.nickname : "Them") },
        { label: "Amount", value: `${money(parseFloat(form.amt || 0))} USDC`, strong: true },
      ],
      _commit: () => orig && applyEdit(orig, form),
    });
  }
  function onFlowComplete() { if (flow && flow._commit) flow._commit(); reassure(); }

  // ── add funds (wallet top-up via testnet faucet) ──
  function applyAddFunds(amount) {
    setData((d) => { const nd = deepClone(d); nd.me.usdc = (nd.me.usdc || 0) + amount; return nd; });
  }
  const openAddFunds = () => setAddFundsOpen(true);

  // ── desktop render ──
  function renderDesktop() {
    const shellProps = {
      layout: t.layout, wide: t.contentWidth === "wide",
      data, demoState: t.homeState, gid, g, screen,
      postWrite, lowUsdc: t.lowUsdc,
      onOpen: (grp) => { setGid(grp.id); setScreen("detail"); setPostWrite(null); },
      onCreate: () => setCreateOpen(true),
      onProfile: () => setProfileOpen(true),
      onHome: () => { setScreen("home"); setPostWrite(null); },
      onAdd: () => setAddOpen(true),
      onSettle: launchSettle,
      onEditExpense: launchEdit, onDeleteExpense: launchDelete,
      onAddFunds: openAddFunds,
    };
    return (
      <DesktopStage w={1280} h={824}>
        <ChromeWindow width={1280} height={824} url="ponti.money" tabs={[{ title: "Ponti — Shared expenses" }]}>
          <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
            {t.auth === "out" ? (
              <DesktopSignIn onLogin={() => setTweak("auth", "in")} />
            ) : (
              <React.Fragment>
                <DesktopShell {...shellProps} />
                {addOpen && g && <DesktopAddModal g={g} onClose={() => setAddOpen(false)}
                  onSubmit={(form) => { setAddOpen(false); launchAdd(form); }} />}
                {editExpense && g && <DesktopEditModal g={g} expense={editExpense} onClose={() => setEditExpense(null)}
                  onSubmit={submitEdit} />}
                {createOpen && <AddSomeoneModal onClose={() => setCreateOpen(false)}
                  onSubmit={({ nick }) => { setCreateOpen(false); launchCreate({ nick }); }} />}
                {profileOpen && <YourPontiModal me={data.me} onClose={() => setProfileOpen(false)}
                  onLogout={() => { setProfileOpen(false); setTweak("auth", "out"); }} onAddFunds={openAddFunds}
                  dark={t.dark} onToggleTheme={(v) => setTweak("dark", v)} />}
                {flow && <FlowSheet flow={flow} tone="wink" placement={t.flowPlace}
                  onClose={() => setFlow(null)} onComplete={onFlowComplete} />}
                {addFundsOpen && <AddFundsPanel me={data.me} placement="modal"
                  onReceived={applyAddFunds} onClose={() => setAddFundsOpen(false)} />}
              </React.Fragment>
            )}
          </div>
        </ChromeWindow>
      </DesktopStage>
    );
  }

  // ── mobile render (reuses mobile screens) ──
  function renderMobile() {
    let body;
    if (t.auth === "out") body = <SignIn onLogin={() => setTweak("auth", "in")} />;
    else if (screen === "signin") body = <SignIn onLogin={() => setScreen("home")} />;
    else if (screen === "detail" && g) body = (
      <GroupDetail g={g} data={data} postWrite={postWrite} lowUsdc={t.lowUsdc}
        onBack={() => { setScreen("home"); setPostWrite(null); }}
        onAdd={() => setScreen("add")} onSettle={launchSettle}
        onEditExpense={launchEdit} onDeleteExpense={launchDelete}
        onAddFunds={openAddFunds} />
    );
    else if (screen === "create") body = <CreateGroup onBack={() => setScreen("home")} onSubmit={launchCreate} onShare={() => setScreen("profile")} />;
    else if (screen === "profile") body = <Profile me={data.me} onBack={() => setScreen("home")} onLogout={() => setTweak("auth", "out")} onAddFunds={openAddFunds} dark={t.dark} onToggleTheme={(v) => setTweak("dark", v)} />;
    else if (screen === "add" && g) body = <AddExpense g={g} onBack={() => setScreen("detail")} onSubmit={launchAdd} />;
    else if (screen === "edit" && g) body = <AddExpense g={g} mode="edit" initial={editExpense} onBack={() => setScreen("detail")} onSubmit={submitEdit} />;
    else body = (
      <Home data={data} demoState={t.homeState}
        onOpenGroup={(grp) => { setGid(grp.id); setScreen("detail"); }}
        onCreate={() => setScreen("create")} onProfile={() => setScreen("profile")}
        onAddFunds={openAddFunds} />
    );
    return (
      <MobileStage>
        <IOSDevice dark={t.dark}>
          <div style={{ position: "relative", minHeight: "100%", paddingTop: 52 }}>
            {body}
            {flow && <FlowSheet flow={flow} tone="wink" placement="sheet"
              onClose={() => setFlow(null)} onComplete={onFlowComplete} />}
            {addFundsOpen && <AddFundsPanel me={data.me} placement="sheet"
              onReceived={applyAddFunds} onClose={() => setAddFundsOpen(false)} />}
          </div>
        </IOSDevice>
      </MobileStage>
    );
  }

  return (
    <div className={"ponti-root theme-" + (t.dark ? "dark" : "light")} style={rootStyle}>
      {desktop ? renderDesktop() : renderMobile()}

      <TweaksPanel>
        <TweakSection label="Canvas" />
        <TweakRadio label="View" value={t.view} options={["desktop", "mobile"]} onChange={(v) => setTweak("view", v)} />
        <TweakSelect label="Layout" value={t.layout} options={["split", "sidebar", "centered"]} onChange={(v) => setTweak("layout", v)} />
        <TweakRadio label="Content width" value={t.contentWidth} options={["compact", "wide"]} onChange={(v) => setTweak("contentWidth", v)} />

        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent} options={Object.values(ACCENTS)} onChange={(v) => setTweak("accent", v)} />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />

        <TweakSection label="Flow widget" />
        <TweakSelect label="Position" value={t.flowPlace} options={["modal", "side", "sheet"]} onChange={(v) => setTweak("flowPlace", v)} />

        <TweakSection label="Demo states" />
        <TweakRadio label="Auth" value={t.auth} options={["in", "out"]} onChange={(v) => setTweak("auth", v)} />
        <TweakSelect label="Home" value={t.homeState} options={["normal", "loading", "empty", "error"]} onChange={(v) => setTweak("homeState", v)} />
        <TweakToggle label="Settle: low USDC" value={t.lowUsdc} onChange={(v) => setTweak("lowUsdc", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
