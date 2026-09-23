import { logoutAction } from "@/sections/auth/actions";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="wrap">
      <div className="tb">
        <a className="brand" href="/">Munshi<em>Cloud</em></a>
        <a className="nl" href="/">← Store</a>
        <span style={{ flex: 1 }} />
        <form action={logoutAction}><button className="nl">Logout</button></form>
      </div>
      <div id="view" style={{ maxWidth: 1000 }}>{children}</div>
    </div>
  );
}