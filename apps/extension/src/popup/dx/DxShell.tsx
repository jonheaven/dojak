import React from 'react';
import { DOGE_COIN_SVG } from '../../content-script/x-overlay/assets';
import './dx.css';

export function DxShell(props: {
  kicker: string;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="dx-root">
      <div className="dx-shell">
        <header className="dx-top">
          <div className="dx-brand">
            <span dangerouslySetInnerHTML={{ __html: DOGE_COIN_SVG }} />
            <div>
              <p className="dx-kicker">{props.kicker}</p>
              <h1 className="dx-title">{props.title}</h1>
            </div>
          </div>
          <button type="button" className="dx-ghost" onClick={props.onBack}>
            Wallet
          </button>
        </header>
        {props.children}
      </div>
    </div>
  );
}
