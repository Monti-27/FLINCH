export function NavigationRules() {
  return <div className="navigation-rules">
    <div className="nav-introduction"><span className="nav-kicker">The quick guide</span><p>How to play</p></div>
    <ol className="navigation-steps">
      <li><span>01</span><div><strong>Fund your seat</strong><p>Four equal test SOL stakes. A full table starts a 90-second round.</p></div></li>
      <li><span>02</span><div><strong>Hold or sell</strong><p>Hold, or swap WSOL for USDC. Successful sellers pay up to 0.25% to holders outside their batch.</p></div></li>
      <li><span>03</span><div><strong>Claim what’s yours</strong><p>Keep unsold WSOL, even at timeout. Sellers claim USDC.</p></div></li>
    </ol>
    <p className="navigation-note">Queued isn’t sold. Failed or expired swaps charge no game penalty.</p>
  </div>;
}
