export type Preferences = {
  version: 1;
  paused: boolean;
  modifier: "alt" | "shift" | "ctrl";
  excluded: string[];
  folder: string;
};
export const defaults: Preferences = {
  version: 1,
  paused: false,
  modifier: "alt",
  excluded: [],
  folder: "",
};
export type ImageItem = {
  url: string;
  name: string;
  width: number;
  height: number;
  format: string;
  frameId?: number;
};
export type Job = {
  id: string;
  image: ImageItem;
  tabId: number;
  frameId: number;
  collection?: number;
  downloadId?: number;
  state: "queued" | "starting" | "active" | "complete" | "failed" | "cancelled";
  error?: string;
};
export type Message =
  | { type: "preferences" }
  | { type: "setPreferences"; patch: Partial<Preferences> }
  | { type: "activate"; tabId: number }
  | { type: "collect"; tabId: number }
  | { type: "scan" }
  | { type: "prepare"; url: string }
  | { type: "save"; images: ImageItem[]; tabId?: number; collection?: number }
  | { type: "jobs"; collection?: number }
  | { type: "cancel"; collection: number }
  | { type: "retry"; collection: number }
  | { type: "feedback"; url: string; ok: boolean; error?: string };
export const api: typeof chrome = (globalThis as any).browser ?? chrome;
export async function prefs(): Promise<Preferences> {
  return {
    ...defaults,
    ...((await api.storage.local.get("preferences"))
      .preferences as Partial<Preferences>),
  };
}
export function safeURL(value: string) {
  try {
    const u = new URL(value);
    return (
      ["http:", "https:", "blob:"].includes(u.protocol) ||
      (/^data:image\/(png|jpeg|gif|webp|avif|svg\+xml);/i.test(value) &&
        value.length < 28_000_000)
    );
  } catch {
    return false;
  }
}
export function filename(url: string, folder = "") {
  let name = "image";
  try {
    const u = new URL(url);
    if (u.protocol === "data:")
      name =
        "image." +
        (u.pathname.split(";")[0].split("/")[1] || "png").replace(
          "svg+xml",
          "svg",
        );
    else if (u.protocol !== "blob:")
      name = decodeURIComponent(u.pathname.split("/").pop() || "image");
  } catch {}
  name =
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/, "")
      .slice(0, 150) || "image";
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))
    name = "_" + name;
  const clean = folder
    .split(/[\\/]+/)
    .filter((p) => p && p !== "." && p !== "..")
    .map((p) => p.replace(/[<>:"|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, ""))
    .filter(Boolean)
    .map((p) => (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p) ? "_" + p : p))
    .join("/");
  return clean ? clean + "/" + name : name;
}
export function dedupe(items: ImageItem[]) {
  return [
    ...new Map(
      items.filter((i) => safeURL(i.url)).map((i) => [i.url, i]),
    ).values(),
  ];
}
export async function send<T = any>(message: Message): Promise<T> {
  const r = await api.runtime.sendMessage(message);
  if (r?.error) throw new Error(r.error);
  return r;
}
