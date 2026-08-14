// The frame every in-app page sits in: one width, one top bar.
//
// Each page used to paint its own — same green bar, same brand mark, same
// avatar on the right, each under its own class prefix and each with its own
// idea of how wide the page should be (1280, 1360, 1480, 1500). Moving
// between two of them shifted the whole page sideways. This is that bar and
// that frame, written once.
//
// The bar carries three things: the brand, a note saying which page this is,
// and whatever the page wants on the right — usually a plan badge and the
// reader's avatar. It is not navigation; the app shell above it (Layout) is
// the navigation, and a second row of links inside the page only competed
// with it.
//
//   <PageFrame note="Search & profiles" right={<Avatar … />}>
//     …the page…
//   </PageFrame>
//
// `note` takes either a string or nodes, so a page with a breadcrumb of its
// own ("/ বায়োডাটা স্টুডিও · Ayesha") passes that instead.

import './PageFrame.css';

export default function PageFrame({ note, right, children, className = '' }) {
  return (
    <div className={`pf ${className}`}>
      <div className="pf-frame">
        <div className="pf-topbar">
          <div className="pf-brand"><span className="pf-logo">স</span><span>SongiSathi</span></div>
          {note ? <span className="pf-note">{note}</span> : null}
          {right ? <div className="pf-right">{right}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
