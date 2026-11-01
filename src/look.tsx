import { createContext, useContext, type ReactNode } from "react";

// Each CRM's own buttons, segmented controls and tags, so Messages looks like the rest of that app. Colors, the font
// and the bubbles come from the --km-… variables (messages.css says which); these are the controls.
export interface Look {
  /** A small button: Mark read, Done, Open customer. */
  button: string;
  /** The segmented control (Needs reply / All; Text / Email). Its buttons get "on" when picked. */
  segment: string;
  /** A small tag beside a name: "lead", "not matched". Tones add " warn" or " gold". */
  tag: string;
  /** A button that reads as a link. */
  link: string;
}

const DEFAULT: Look = { button: "km-btn", segment: "km-seg", tag: "km-tag", link: "km-link" };
const Ctx = createContext<Look>(DEFAULT);

/** Wrap Messages (or the whole app) once: <MessagesLook value={{ button: "btn small", segment: "seg" }}>. */
export function MessagesLook({ value, children }: { value: Partial<Look>; children: ReactNode }) {
  return <Ctx.Provider value={{ ...DEFAULT, ...value }}>{children}</Ctx.Provider>;
}
export const useLook = () => useContext(Ctx);
