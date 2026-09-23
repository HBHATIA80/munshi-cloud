"use client";
import { logoutAction } from "@/sections/auth/actions";

export function LogoutBtn() {
  return (
    <form action={logoutAction}>
      <button className="btn blk">Logout</button>
    </form>
  );
}